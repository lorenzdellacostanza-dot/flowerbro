package it.flowerbro.store;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
class CatalogStore {
    private final StoreDatabase database;

    CatalogStore(StoreDatabase database) {
        this.database = database;
    }

    Catalog read() throws SQLException {
        try (Connection connection = database.open()) {
            connection.setReadOnly(true);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            connection.setAutoCommit(false);
            Catalog catalog = new Catalog(products(connection), tagLabels(connection), occasions(connection));
            connection.commit();
            return catalog;
        }
    }

    private static List<Product> products(Connection connection) throws SQLException {
        List<Product> products = new ArrayList<>();
        try (var statement = connection.prepareStatement("""
                SELECT p.id, p.name, p.kind, p.price, p.image_url, p.description, p.composition,
                       p.delivery_time, COALESCE(p.rating, 0) AS stars, p.stock_quantity,
                       ARRAY(SELECT t.tag_code FROM product_tags t WHERE t.product_id = p.id
                             ORDER BY t.tag_code) AS tags,
                       ARRAY(SELECT o.origin FROM product_origins o WHERE o.product_id = p.id
                             ORDER BY o.origin) AS origins
                FROM products p
                WHERE p.active
                ORDER BY p.display_order, p.id
                """);
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                products.add(new Product(
                        rows.getString("id"), rows.getString("name"), rows.getString("kind"),
                        rows.getBigDecimal("price"), rows.getString("image_url"), rows.getString("description"),
                        rows.getString("composition"), rows.getString("delivery_time"), rows.getBigDecimal("stars"),
                        rows.getObject("stock_quantity", Integer.class),
                        strings(rows, "tags"), strings(rows, "origins")));
            }
        }
        return products;
    }

    private static Map<String, String> tagLabels(Connection connection) throws SQLException {
        Map<String, String> labels = new LinkedHashMap<>();
        try (var statement = connection.prepareStatement("SELECT code, label FROM tags ORDER BY code");
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                labels.put(rows.getString("code"), rows.getString("label"));
            }
        }
        return labels;
    }

    private static List<Occasion> occasions(Connection connection) throws SQLException {
        List<Occasion> occasions = new ArrayList<>();
        try (var statement = connection.prepareStatement("""
                SELECT o.code, o.label, o.description, o.image_url,
                       ARRAY(SELECT t.tag_code FROM occasion_tags t WHERE t.occasion_code = o.code
                             ORDER BY t.tag_code) AS tags
                FROM occasions o
                ORDER BY o.code
                """);
             var rows = statement.executeQuery()) {
            while (rows.next()) {
                occasions.add(new Occasion(rows.getString("code"), rows.getString("label"),
                        rows.getString("description"), rows.getString("image_url"), strings(rows, "tags")));
            }
        }
        return occasions;
    }

    private static List<String> strings(ResultSet rows, String column) throws SQLException {
        var array = rows.getArray(column);
        try {
            return List.of((String[]) array.getArray());
        } finally {
            array.free();
        }
    }

    record Catalog(List<Product> products, Map<String, String> tagLabels, List<Occasion> occasions) {}

    record Product(String id, String name, String kind, BigDecimal price, String imageUrl, String description,
                   String composition, String deliveryTime, BigDecimal stars, Integer stockQuantity,
                   List<String> tags, List<String> origins) {}

    record Occasion(String id, String label, String description, String imageUrl, List<String> tags) {}
}
