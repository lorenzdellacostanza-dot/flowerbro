package it.flowerbro.store;

import it.flowerbro.security.PersonalDataCrypto.Field;
import it.flowerbro.web.BrowserRequest.Rejection;
import java.io.IOException;
import java.math.BigDecimal;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

@Repository
class OrderStore {
    private final StoreDatabase database;
    private final JsonMapper json;

    OrderStore(StoreDatabase database, JsonMapper json) {
        this.database = database;
        this.json = json;
    }

    Receipt place(CheckoutRequest checkout) throws SQLException, GeneralSecurityException, IOException {
        var crypto = database.deliveryCrypto();
        byte[] digest = crypto.checkoutDigest(json.writeValueAsBytes(checkout));
        byte[] delivery = crypto.encrypt(Field.ORDER_DELIVERY, json.writeValueAsString(checkout.delivery()));

        try (Connection connection = database.open()) {
            connection.setAutoCommit(false);
            try {
                Long orderId = insertOrder(connection, checkout.checkoutKey(), digest, delivery);
                if (orderId != null) {
                    insertItems(connection, orderId, checkout);
                }
                Receipt receipt = getReceipt(connection, checkout.checkoutKey(), digest);
                connection.commit();
                return receipt;
            } catch (SQLException | RuntimeException failure) {
                try {
                    connection.rollback();
                } catch (SQLException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
                throw failure;
            }
        }
    }

    private static Long insertOrder(Connection connection, UUID key, byte[] digest, byte[] delivery)
            throws SQLException {
        try (var insert = connection.prepareStatement("""
                INSERT INTO orders (checkout_key, checkout_hash, delivery_ciphertext)
                VALUES (?, ?, ?)
                ON CONFLICT (checkout_key) DO NOTHING
                RETURNING id
                """)) {
            insert.setObject(1, key);
            insert.setBytes(2, digest);
            insert.setBytes(3, delivery);
            try (var row = insert.executeQuery()) {
                return row.next() ? row.getLong("id") : null;
            }
        }
    }

    private static void insertItems(Connection connection, long orderId, CheckoutRequest checkout)
            throws SQLException {
        try (var product = connection.prepareStatement("""
                SELECT name, kind, price, stock_quantity FROM products WHERE id = ? AND active FOR UPDATE
                """);
             var item = connection.prepareStatement("""
                INSERT INTO order_items (order_id, product_id, product_name, product_kind, unit_price, quantity)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
             var reserve = connection.prepareStatement("""
                UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?
                """)) {
            // Items are sorted by product ID so concurrent checkouts acquire locks in the same order.
            for (var entry : checkout.items().entrySet()) {
                long id = entry.getKey();
                CheckoutRequest.Line line = entry.getValue();
                product.setLong(1, id);
                try (var row = product.executeQuery()) {
                    if (!row.next()) {
                        throw changedCart();
                    }
                    BigDecimal price = row.getBigDecimal("price");
                    Integer stock = row.getObject("stock_quantity", Integer.class);
                    if (price.compareTo(line.expectedPrice()) != 0 || (stock != null && stock < line.quantity())) {
                        throw changedCart();
                    }
                    item.setLong(1, orderId);
                    item.setLong(2, id);
                    item.setString(3, row.getString("name"));
                    item.setString(4, row.getString("kind"));
                    item.setBigDecimal(5, price);
                    item.setInt(6, line.quantity());
                    item.addBatch();
                    if (stock != null) {
                        reserve.setInt(1, line.quantity());
                        reserve.setLong(2, id);
                        reserve.addBatch();
                    }
                }
            }
            item.executeBatch();
            reserve.executeBatch();
        }
    }

    private static Receipt getReceipt(Connection connection, UUID key, byte[] digest) throws SQLException {
        try (var select = connection.prepareStatement("""
                SELECT o.id, o.checkout_hash, t.item_count, t.total
                FROM orders o JOIN order_totals t ON t.order_id = o.id
                WHERE o.checkout_key = ?
                """)) {
            select.setObject(1, key);
            try (var row = select.executeQuery()) {
                if (!row.next()) {
                    throw new SQLException("Receipt is missing");
                }
                if (!MessageDigest.isEqual(digest, row.getBytes("checkout_hash"))) {
                    throw new Rejection(HttpStatus.CONFLICT, "Questo tentativo appartiene a un ordine diverso.");
                }
                return new Receipt(row.getString("id"), row.getLong("item_count"), row.getBigDecimal("total"));
            }
        }
    }

    private static Rejection changedCart() {
        return new Rejection(HttpStatus.CONFLICT,
                "Il prezzo o la disponibilità è cambiata. Controlla il carrello e riprova.");
    }

    record Receipt(String id, long count, BigDecimal total) {}
}
