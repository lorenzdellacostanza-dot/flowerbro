package it.flowerbro.store;

import it.flowerbro.web.BrowserRequest.Rejection;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;

record CheckoutRequest(UUID checkoutKey, Delivery delivery, SortedMap<Long, Line> items) {
    private static final Pattern EMAIL = Pattern.compile("[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+",
            Pattern.UNICODE_CHARACTER_CLASS);
    private static final Pattern POSTCODE = Pattern.compile("[0-9]{5}");
    private static final Pattern PRODUCT_ID = Pattern.compile("[1-9][0-9]{0,18}");
    private static final BigDecimal MAX_PRICE = new BigDecimal("99999999.99");

    static CheckoutRequest from(JsonNode body) {
        UUID key = parseKey(body.path("checkoutKey").stringValue(""));
        JsonNode address = body.path("delivery");
        String email = deliveryText(address, "email", 254, true);
        String postcode = deliveryText(address, "postcode", 5, true);
        if (!EMAIL.matcher(email).matches() || !POSTCODE.matcher(postcode).matches()) {
            throw invalidDelivery();
        }
        Delivery delivery = new Delivery(
                deliveryText(address, "recipient", 100, true), email,
                deliveryText(address, "street", 150, true), deliveryText(address, "city", 100, true),
                postcode, "IT", deliveryText(address, "message", 200, false));

        JsonNode entries = body.path("items");
        if (!entries.isArray() || entries.isEmpty() || entries.size() > 100) {
            throw invalidCart();
        }
        SortedMap<Long, Line> items = new TreeMap<>();
        for (JsonNode entry : entries) {
            long id = productId(entry.path("productId").stringValue(""));
            JsonNode quantity = entry.path("quantity");
            if (!quantity.isIntegralNumber() || !quantity.canConvertToInt() || quantity.intValue() < 1) {
                throw invalidCart();
            }
            var line = new Line(quantity.intValue(), expectedPrice(entry.path("expectedPrice")));
            if (items.putIfAbsent(id, line) != null) {
                throw invalidCart();
            }
        }
        return new CheckoutRequest(key, delivery, items);
    }

    private static UUID parseKey(String key) {
        try {
            UUID id = UUID.fromString(key);
            if (id.toString().equals(key)) {
                return id;
            }
        } catch (IllegalArgumentException invalidUuid) {
            // The same rejection covers malformed and noncanonical identifiers.
        }
        throw new Rejection(HttpStatus.BAD_REQUEST, "Identificativo del checkout non valido.");
    }

    private static long productId(String id) {
        if (PRODUCT_ID.matcher(id).matches()) {
            try {
                return Long.parseLong(id);
            } catch (NumberFormatException outOfRange) {
                throw invalidCart();
            }
        }
        throw invalidCart();
    }

    private static BigDecimal expectedPrice(JsonNode price) {
        if (!price.isNumber()) {
            throw invalidCart();
        }
        try {
            BigDecimal value = price.decimalValue().stripTrailingZeros();
            if (value.signum() >= 0 && value.compareTo(MAX_PRICE) <= 0 && value.scale() <= 2) {
                return value.setScale(2, RoundingMode.UNNECESSARY);
            }
        } catch (ArithmeticException | IllegalArgumentException | JacksonException invalidPrice) {
            throw invalidCart();
        }
        throw invalidCart();
    }

    private static String deliveryText(JsonNode address, String field, int limit, boolean required) {
        JsonNode input = address.path(field);
        if (!required && (input.isNull() || input.isMissingNode())) {
            return "";
        }
        String value = input.stringValue("").strip();
        if (!input.isString() || (required && value.isEmpty()) || value.length() > limit
                || value.codePoints().anyMatch(c -> invalidCharacter(c, required))) {
            throw invalidDelivery();
        }
        return value;
    }

    private static boolean invalidCharacter(int character, boolean singleLine) {
        if (!singleLine && (character == '\n' || character == '\r' || character == '\t')) {
            return false;
        }
        return Character.isISOControl(character)
                || (character >= Character.MIN_SURROGATE && character <= Character.MAX_SURROGATE);
    }

    private static Rejection invalidCart() {
        return new Rejection(HttpStatus.BAD_REQUEST, "Controlla i prodotti e le quantità del carrello.");
    }

    private static Rejection invalidDelivery() {
        return new Rejection(HttpStatus.BAD_REQUEST, "Controlla i dati di consegna, l’email e il CAP.");
    }

    record Delivery(String recipient, String email, String street, String city, String postcode,
                    String countryCode, String message) {}

    record Line(int quantity, BigDecimal expectedPrice) {}
}
