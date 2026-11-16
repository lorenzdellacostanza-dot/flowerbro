package it.flowerbro;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Base64;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.server.context.WebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import tools.jackson.databind.json.JsonMapper;

class AccountApiTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void accountLifecycleUsesProtectedServerSideSessions(@TempDir Path directory) throws Exception {
        Path database = directory.resolve("account.sqlite");
        try (var context = startApplication(database)) {
            String origin = originOf(context);
            try (var client = HttpClient.newHttpClient()) {
                var anonymous = get(client, origin, "");
                assertEquals(200, anonymous.statusCode());
                assertTrue(JSON.readTree(anonymous.body()).path("profile").isNull());
                assertEquals("no-store", anonymous.headers().firstValue("Cache-Control").orElseThrow());

                String name = "Synthetic Account";
                String email = "smoke-test@example.invalid";
                String password = "synthetic password for this test";
                String signup = """
                        {"name":"%s","email":"%s","password":"%s"}
                        """.formatted(name, email, password);
                assertEquals(403, post(client, origin, "register", "https://external.example", "", signup).statusCode());
                var registered = post(client, origin, "register", origin, "", signup);
                assertEquals(201, registered.statusCode());
                String setCookie = registered.headers().firstValue("Set-Cookie").orElseThrow();
                assertTrue(setCookie.contains("HttpOnly"));
                assertTrue(setCookie.contains("SameSite=Strict"));
                String firstCookie = setCookie.split(";", 2)[0];
                assertEquals(email, JSON.readTree(get(client, origin, firstCookie).body()).path("profile").path("email").asString());

                String login = """
                        {"email":"%s","password":"%s"}
                        """.formatted(email, password);
                assertEquals(401, post(client, origin, "login", origin, "", login.replace(password, "wrong password")).statusCode());
                var signedIn = post(client, origin, "login", origin, firstCookie, login);
                assertEquals(200, signedIn.statusCode());
                String newCookie = signedIn.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
                assertNotEquals(firstCookie, newCookie);
                assertTrue(JSON.readTree(get(client, origin, firstCookie).body()).path("profile").isNull());

                String contents = new String(Files.readAllBytes(database), StandardCharsets.ISO_8859_1);
                for (String plaintext : new String[] {name, email, password, token(firstCookie), token(newCookie)}) {
                    assertFalse(contents.contains(plaintext), "The database must not contain account plaintext");
                }
                assertEquals(204, post(client, origin, "logout", origin, newCookie, "{}").statusCode());
                assertTrue(JSON.readTree(get(client, origin, newCookie).body()).path("profile").isNull());
            }
        }
    }

    @Test
    void accountErrorsUseTheApiContractAndLimitAttemptsByNormalizedEmail(@TempDir Path directory) throws Exception {
        try (var context = startApplication(directory.resolve("account.sqlite"));
                var client = HttpClient.newHttpClient()) {
            String origin = originOf(context);
            String signup = """
                    {"name":"  Test Account  ","email":"  Test@example.invalid  ","password":"a synthetic test password"}
                    """;
            var invalid = post(client, origin, "register", origin, "", signup.replace("a synthetic test password", "short"));
            assertEquals(400, invalid.statusCode());
            assertEquals("Inserisci un nome e una password di almeno 15 caratteri.",
                    JSON.readTree(invalid.body()).path("error").asString());

            var registered = post(client, origin, "register", origin, "", signup);
            assertEquals(201, registered.statusCode());
            var profile = JSON.readTree(registered.body()).path("profile");
            assertEquals("Test Account", profile.path("name").asString());
            assertEquals("test@example.invalid", profile.path("email").asString());
            assertEquals(409, post(client, origin, "register", origin, "", signup).statusCode());

            String wrongLogin = """
                    {"email":"%s","password":"wrong password"}
                    """;
            for (int attempt = 0; attempt < 8; attempt++) {
                String email = attempt % 2 == 0 ? "  TEST@example.invalid  " : "test@example.invalid";
                assertEquals(401, post(client, origin, "login", origin, "", wrongLogin.formatted(email)).statusCode());
            }
            var blocked = post(client, origin, "login", origin, "", wrongLogin.formatted("test@example.invalid"));
            assertEquals(429, blocked.statusCode());
            assertEquals("900", blocked.headers().firstValue("Retry-After").orElseThrow());
            assertTrue(blocked.headers().firstValue("Set-Cookie").isEmpty());
        }
    }

    private static ConfigurableApplicationContext startApplication(Path database) {
        String testKey = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        return SpringApplication.run(FlowerBroApplication.class,
                "--server.port=0", "--FLOWERBRO_DB_PATH=" + database, "--FLOWERBRO_DATA_KEY=" + testKey,
                "--FLOWERBRO_ORIGIN=", "--NODE_ENV=test", "--spring.profiles.active=test");
    }

    private static String originOf(ConfigurableApplicationContext context) {
        int port = ((WebServerApplicationContext) context).getWebServer().getPort();
        return "http://127.0.0.1:" + port;
    }

    private static HttpResponse<String> get(HttpClient client, String origin, String cookie) throws Exception {
        return send(client, request(origin, "", cookie).GET());
    }

    private static HttpResponse<String> post(HttpClient client, String origin, String action,
            String browserOrigin, String cookie, String body) throws Exception {
        return send(client, request(origin, "/" + action, cookie)
                .header("Origin", browserOrigin)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)));
    }

    private static HttpRequest.Builder request(String origin, String path, String cookie) {
        var request = HttpRequest.newBuilder(URI.create(origin + "/api/account" + path))
                .timeout(Duration.ofSeconds(10));
        if (!cookie.isEmpty()) request.header("Cookie", cookie);
        return request;
    }

    private static HttpResponse<String> send(HttpClient client, HttpRequest.Builder request) throws Exception {
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static String token(String cookie) {
        return cookie.substring(cookie.indexOf('=') + 1);
    }
}
