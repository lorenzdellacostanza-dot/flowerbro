package it.flowerbro.account;

import it.flowerbro.BackendSettings;
import it.flowerbro.account.AccountService.AuthenticationRejected;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    private static final Logger LOG = LoggerFactory.getLogger(AccountController.class);
    private static final int MAX_JSON_BYTES = 4096;
    private static final Pattern LOOPBACK_HOST =
            Pattern.compile("(?:localhost|127\\.0\\.0\\.1|\\[::1\\])(?::\\d{1,5})?");
    private static final Pattern SESSION_TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");

    private final AccountService accounts;
    private final URI publicOrigin;
    private final String cookieName;
    private final ObjectReader jsonReader;

    public AccountController(AccountService accounts, BackendSettings settings, JsonMapper json) {
        this.accounts = accounts;
        this.publicOrigin = settings.publicOrigin();
        this.cookieName = publicOrigin == null ? "flowerbro-session-local" : "__Host-flowerbro-session";
        this.jsonReader = json.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    @GetMapping({"", "/"})
    public ResponseEntity<ProfileResponse> profile(HttpServletRequest request) {
        checkProxy(request);
        checkBrowserOrigin(request, false);

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
        String ip = checkProxy(request);
        checkBrowserOrigin(request, true);
        JsonNode body = readBody(request);
        AccountSession session = accounts.register(body.path("name").stringValue(""),
                body.path("email").stringValue(""), body.path("password").stringValue(""), sessionToken(request), ip);
        return authenticated(HttpStatus.CREATED, session);
    }

    @PostMapping({"/login", "/login/"})
    public ResponseEntity<ProfileResponse> login(HttpServletRequest request) {
        String ip = checkProxy(request);
        checkBrowserOrigin(request, true);
        JsonNode body = readBody(request);
        AccountSession session = accounts.signIn(body.path("email").stringValue(""),
                body.path("password").stringValue(""), sessionToken(request), ip);
        return authenticated(HttpStatus.OK, session);
    }

    @PostMapping({"/logout", "/logout/"})
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        checkProxy(request);
        checkBrowserOrigin(request, true);
        readBody(request);

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

    private String checkProxy(HttpServletRequest request) {
        String host = singleHeader(request, HttpHeaders.HOST);
        try {
            InetAddress peer = InetAddress.ofLiteral(request.getRemoteAddr());
            if (!peer.isLoopbackAddress()) {
                throw unauthorized();
            }
            if (publicOrigin == null) {
                if (host == null || !LOOPBACK_HOST.matcher(host).matches()) {
                    throw unauthorized();
                }
                return peer.getHostAddress();
            }
            String forwardedIp = singleHeader(request, "X-Forwarded-For");
            if (!publicOrigin.getRawAuthority().equals(host)
                    || !"https".equals(singleHeader(request, "X-Forwarded-Proto"))
                    || forwardedIp == null) {
                throw unauthorized();
            }
            return InetAddress.ofLiteral(forwardedIp).getHostAddress();
        } catch (IllegalArgumentException invalidAddress) {
            throw unauthorized();
        }
    }

    private void checkBrowserOrigin(HttpServletRequest request, boolean required) {
        String expected = publicOrigin == null ? "http://" + singleHeader(request, HttpHeaders.HOST)
                : publicOrigin.toString();
        String origin = singleHeader(request, HttpHeaders.ORIGIN);
        String fetchSite = singleHeader(request, "Sec-Fetch-Site");
        if (((required || origin != null) && !expected.equals(origin))
                || "cross-site".equals(fetchSite) || "same-site".equals(fetchSite)) {
            throw unauthorized();
        }
    }

    private static String singleHeader(HttpServletRequest request, String name) {
        Enumeration<String> values = request.getHeaders(name);
        if (!values.hasMoreElements()) {
            return null;
        }
        String value = values.nextElement();
        if (values.hasMoreElements()) {
            throw unauthorized();
        }
        return value;
    }

    private JsonNode readBody(HttpServletRequest request) {
        try {
            String contentType = singleHeader(request, HttpHeaders.CONTENT_TYPE);
            MediaType type = contentType == null ? null : MediaType.parseMediaType(contentType);
            String encoding = singleHeader(request, HttpHeaders.CONTENT_ENCODING);
            if (type == null || !type.equalsTypeAndSubtype(MediaType.APPLICATION_JSON)
                    || (type.getCharset() != null && !StandardCharsets.UTF_8.equals(type.getCharset()))
                    || (encoding != null && !"identity".equalsIgnoreCase(encoding))) {
                throw unsupportedContent();
            }
        } catch (InvalidMediaTypeException invalidType) {
            throw unsupportedContent();
        }

        if (request.getContentLengthLong() > MAX_JSON_BYTES) {
            throw oversizedRequest();
        }
        try {
            byte[] bytes = request.getInputStream().readNBytes(MAX_JSON_BYTES + 1);
            if (bytes.length > MAX_JSON_BYTES) {
                throw oversizedRequest();
            }
            String json = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
            JsonNode body = jsonReader.readTree(json);
            if (!body.isObject()) {
                throw invalidRequest();
            }
            return body;
        } catch (IOException | JacksonException malformedRequest) {
            // Parsing exceptions may include input containing credentials.
            throw invalidRequest();
        }
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

    @ExceptionHandler(ApiRejection.class)
    ResponseEntity<ErrorResponse> rejected(ApiRejection rejection) {
        return error(rejection.status, rejection.getMessage());
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

    private static ApiRejection unauthorized() {
        return new ApiRejection(HttpStatus.FORBIDDEN, "Richiesta non autorizzata.");
    }

    private static ApiRejection unsupportedContent() {
        return new ApiRejection(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Formato della richiesta non supportato.");
    }

    private static ApiRejection oversizedRequest() {
        return new ApiRejection(HttpStatus.CONTENT_TOO_LARGE, "Richiesta non valida.");
    }

    private static ApiRejection invalidRequest() {
        return new ApiRejection(HttpStatus.BAD_REQUEST, "Richiesta non valida.");
    }

    private record ProfileResponse(AccountProfile profile) {}
    private record ErrorResponse(String error) {}

    private static final class ApiRejection extends RuntimeException {
        private final HttpStatus status;

        ApiRejection(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }
    }
}
