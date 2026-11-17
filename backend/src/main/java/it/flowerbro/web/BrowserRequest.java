package it.flowerbro.web;

import it.flowerbro.BackendSettings;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.regex.Pattern;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectReader;
import tools.jackson.databind.json.JsonMapper;

@Component
public class BrowserRequest {
    private static final Pattern LOOPBACK_HOST =
            Pattern.compile("(?:localhost|127\\.0\\.0\\.1|\\[::1\\])(?::\\d{1,5})?");

    private final URI publicOrigin;
    private final ObjectReader jsonReader;

    public BrowserRequest(BackendSettings settings, JsonMapper json) {
        publicOrigin = settings.publicOrigin();
        jsonReader = json.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    public String verify(HttpServletRequest request, boolean originRequired) {
        String host = singleHeader(request, HttpHeaders.HOST);
        String ip = checkProxy(request, host);
        String expected = publicOrigin == null ? "http://" + host : publicOrigin.toString();
        String origin = singleHeader(request, HttpHeaders.ORIGIN);
        String fetchSite = singleHeader(request, "Sec-Fetch-Site");
        if (((originRequired || origin != null) && !expected.equals(origin))
                || "cross-site".equals(fetchSite) || "same-site".equals(fetchSite)) {
            throw unauthorized();
        }
        return ip;
    }

    public JsonNode readJson(HttpServletRequest request, int maxBytes) {
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

        if (request.getContentLengthLong() > maxBytes) {
            throw oversizedRequest();
        }
        try {
            byte[] bytes = request.getInputStream().readNBytes(maxBytes + 1);
            if (bytes.length > maxBytes) {
                throw oversizedRequest();
            }
            String json = StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
            JsonNode body = jsonReader.readTree(json);
            if (!body.isObject()) {
                throw invalidRequest();
            }
            return body;
        } catch (IOException | JacksonException malformedRequest) {
            // Parsing exceptions can include submitted personal data.
            throw invalidRequest();
        }
    }

    private String checkProxy(HttpServletRequest request, String host) {
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

    private static Rejection unauthorized() {
        return new Rejection(HttpStatus.FORBIDDEN, "Richiesta non autorizzata.");
    }

    private static Rejection unsupportedContent() {
        return new Rejection(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Formato della richiesta non supportato.");
    }

    private static Rejection oversizedRequest() {
        return new Rejection(HttpStatus.CONTENT_TOO_LARGE, "Richiesta non valida.");
    }

    private static Rejection invalidRequest() {
        return new Rejection(HttpStatus.BAD_REQUEST, "Richiesta non valida.");
    }

    public static final class Rejection extends RuntimeException {
        private final HttpStatus status;

        public Rejection(HttpStatus status, String message) {
            super(message);
            this.status = status;
        }

        public HttpStatus status() {
            return status;
        }
    }
}
