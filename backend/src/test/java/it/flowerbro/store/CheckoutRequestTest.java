package it.flowerbro.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import it.flowerbro.web.BrowserRequest.Rejection;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.json.JsonMapper;

class CheckoutRequestTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String CHECKOUT = """
            {
              "checkoutKey": "d87bdf15-5597-4926-8c03-2b707b748a9f",
              "delivery": {
                "recipient": "  Test Recipient  ",
                "email": "test@example.invalid",
                "street": "Via Prova 10",
                "city": "Roma",
                "postcode": "00100"
              },
              "items": [%s]
            }
            """;
    private static final String ROSE = """
            {"productId":"1", "quantity":2, "expectedPrice":10}
            """;

    @Test
    void preservesThePostalCodeAndOrdersItemsByIdForStockUpdates() {
        var checkout = parse("""
                {"productId":"7", "quantity":1, "expectedPrice":48.5},
                """ + ROSE);

        assertEquals("00100", checkout.delivery().postcode());
        assertEquals("Test Recipient", checkout.delivery().recipient());
        assertEquals(List.of(1L, 7L), new ArrayList<>(checkout.items().keySet()));
        assertEquals(new BigDecimal("48.50"), checkout.items().get(7L).expectedPrice());
    }

    @Test
    void rejectsDuplicateProductsAndValuesThatCannotRepresentOrderLines() {
        assertInvalid(ROSE + "," + ROSE);
        assertInvalid(ROSE.replace("\"quantity\":2", "\"quantity\":2.2"));
        assertInvalid(ROSE.replace("\"quantity\":2", "\"quantity\":2147483648"));
        assertInvalid(ROSE.replace("\"expectedPrice\":10", "\"expectedPrice\":1.009"));
    }

    private static CheckoutRequest parse(String items) {
        return CheckoutRequest.from(JSON.readTree(CHECKOUT.formatted(items)));
    }

    private static void assertInvalid(String items) {
        Rejection rejection = assertThrows(Rejection.class, () -> parse(items));
        assertEquals(HttpStatus.BAD_REQUEST, rejection.status());
    }
}
