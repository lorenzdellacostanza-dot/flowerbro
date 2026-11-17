package it.flowerbro.account;

import it.flowerbro.BackendSettings;
import it.flowerbro.account.AccountService.AuthenticationRejected;
import it.flowerbro.web.BrowserRequest;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    private static final Logger LOG = LoggerFactory.getLogger(AccountController.class);
    private static final int MAX_JSON_BYTES = 4096;
    private static final Pattern SESSION_TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");

    private final AccountService accounts;
    private final URI publicOrigin;
    private final String cookieName;
    private final BrowserRequest browserRequest;

    public AccountController(AccountService accounts, BackendSettings settings, BrowserRequest browserRequest) {
        this.accounts = accounts;
        this.publicOrigin = settings.publicOrigin();
        this.cookieName = publicOrigin == null ? "flowerbro-session-local" : "__Host-flowerbro-session";
        this.browserRequest = browserRequest;
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ProfileResponse> profile(HttpServletRequest request) {
        browserRequest.verify(request, false);

        String token = sessionToken(request);
        AccountProfile profile = accounts.profile(token).orElse(null);
        var response = response(HttpStatus.OK);
        if (token != null && profile == null) {
            response.header(HttpHeaders.SET_COOKIE, sessionCookie("", 0));
        }
        return response.body(new ProfileResponse(profile));
    }

    @PostMapping({"/register", "/register/"})
    public ResponseEntity<ProfileResponse> register(HttpServletRequest request) {
        String ip = browserRequest.verify(request, true);
        JsonNode body = browserRequest.readJson(request, MAX_JSON_BYTES);
        AccountSession session = accounts.register(body.path("name").stringValue(""),
                body.path("email").stringValue(""), body.path("password").stringValue(""), sessionToken(request), ip);
        return authenticated(HttpStatus.CREATED, session);
    }

    @PostMapping({"/login", "/login/"})
    public ResponseEntity<ProfileResponse> login(HttpServletRequest request) {
        String ip = browserRequest.verify(request, true);
        JsonNode body = browserRequest.readJson(request, MAX_JSON_BYTES);
        AccountSession session = accounts.signIn(body.path("email").stringValue(""),
                body.path("password").stringValue(""), sessionToken(request), ip);
        return authenticated(HttpStatus.OK, session);
    }

    @PostMapping({"/logout", "/logout/"})
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        browserRequest.verify(request, true);
        browserRequest.readJson(request, MAX_JSON_BYTES);

        accounts.signOut(sessionToken(request));
        return ResponseEntity.noContent()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.SET_COOKIE, sessionCookie("", 0))
                .build();
    }

    @RequestMapping("/{*path}")
    public ResponseEntity<ErrorResponse> unknownPath() {
        return error(HttpStatus.NOT_FOUND, "Pagina non trovata.");
    }

    private ResponseEntity<ProfileResponse> authenticated(HttpStatus status, AccountSession session) {
        return response(status)
                .header(HttpHeaders.SET_COOKIE, sessionCookie(session.token(), AccountSession.LIFETIME_SECONDS))
                .body(new ProfileResponse(session.profile()));
    }

    private String sessionToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        String token = null;
        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                if (token != null || !SESSION_TOKEN.matcher(cookie.getValue()).matches()) {
                    return null;
                }
                token = cookie.getValue();
            }
        }
        return token;
    }

    private String sessionCookie(String token, long maxAge) {
        return ResponseCookie.from(cookieName, token)
                .path("/")
                .httpOnly(true)
                .secure(publicOrigin != null)
                .sameSite("Strict")
                .maxAge(maxAge)
                .build()
                .toString();
    }

    private static ResponseEntity.BodyBuilder response(HttpStatus status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.APPLICATION_JSON);
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, String message) {
        return response(status).body(new ErrorResponse(message));
    }

    private static ResponseEntity<ErrorResponse> retry(long seconds, String message) {
        return response(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(seconds))
                .body(new ErrorResponse(message));
    }

    @ExceptionHandler(BrowserRequest.Rejection.class)
    ResponseEntity<ErrorResponse> rejected(BrowserRequest.Rejection rejection) {
        return error(rejection.status(), rejection.getMessage());
    }

    @ExceptionHandler(AuthenticationRejected.class)
    ResponseEntity<ErrorResponse> authenticationRejected(AuthenticationRejected rejection) {
        var failure = rejection.failure();
        return switch (failure) {
            case INVALID_CREDENTIALS -> error(HttpStatus.BAD_REQUEST, "Inserisci un’email e una password valide.");
            case INVALID_REGISTRATION -> error(HttpStatus.BAD_REQUEST,
                    "Inserisci un nome e una password di almeno 15 caratteri.");
            case REGISTRATION_CONFLICT -> error(HttpStatus.CONFLICT, "Registrazione non riuscita con questi dati.");
            case INCORRECT_CREDENTIALS -> error(HttpStatus.UNAUTHORIZED, "Email o password errata.");
            case AUTH_BUSY -> retry(failure.retryAfterSeconds(), "Troppe richieste. Riprova tra poco.");
            case ATTEMPTS_EXHAUSTED -> retry(failure.retryAfterSeconds(),
                    "Troppi tentativi. Riprova tra qualche minuto.");
        };
    }

    @ExceptionHandler(RuntimeException.class)
    ResponseEntity<ErrorResponse> internalError(RuntimeException failure) {
        LOG.error("Errore interno dell’API account ({})", failure.getClass().getSimpleName());
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Servizio account momentaneamente non disponibile.");
    }

    private record ProfileResponse(AccountProfile profile) {}
    private record ErrorResponse(String error) {}
}
