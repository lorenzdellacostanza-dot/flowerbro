package it.flowerbro.store;

import it.flowerbro.web.BrowserRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.sql.SQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
class StoreController {
    private static final Logger LOG = LoggerFactory.getLogger(StoreController.class);
    private static final int MAX_ORDER_BYTES = 16 * 1024;

    private final BrowserRequest browserRequest;
    private final CatalogStore catalog;
    private final OrderStore orders;

    StoreController(BrowserRequest browserRequest, CatalogStore catalog, OrderStore orders) {
        this.browserRequest = browserRequest;
        this.catalog = catalog;
        this.orders = orders;
    }

    @GetMapping({"/catalog", "/catalog/"})
    ResponseEntity<CatalogStore.Catalog> catalog() throws SQLException {
        return response(HttpStatus.OK).body(catalog.read());
    }

    @PostMapping({"/orders", "/orders/"})
    ResponseEntity<OrderStore.Receipt> order(HttpServletRequest request)
            throws SQLException, GeneralSecurityException, IOException {
        browserRequest.verify(request, true);
        var checkout = CheckoutRequest.from(browserRequest.readJson(request, MAX_ORDER_BYTES));
        return response(HttpStatus.CREATED).body(orders.place(checkout));
    }

    @ExceptionHandler(BrowserRequest.Rejection.class)
    ResponseEntity<ErrorResponse> rejected(BrowserRequest.Rejection rejection) {
        return response(rejection.status()).body(new ErrorResponse(rejection.getMessage()));
    }

    @ExceptionHandler({SQLException.class, GeneralSecurityException.class, IOException.class})
    ResponseEntity<ErrorResponse> unavailable(Exception failure) {
        String type = failure instanceof SQLException sql ? sql.getSQLState() : failure.getClass().getSimpleName();
        LOG.warn("Servizio negozio non disponibile ({})", type);
        return response(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ErrorResponse("Il negozio è momentaneamente non disponibile. Riprova tra poco."));
    }

    private static ResponseEntity.BodyBuilder response(HttpStatus status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_JSON);
    }

    private record ErrorResponse(String error) {}
}
