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
import tools.jackson.databind.json.JsonMapper;

class AccountApiTest {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void accountLifecycleUsesProtectedServerSideSessions(@TempDir Path directory) throws Exception {
        Path database = directory.resolve("account.sqlite");
        String testKey = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        try (var context = SpringApplication.run(FlowerBroApplication.class,
                "--server.port=0", "--FLOWERBRO_DB_PATH=" + database, "--FLOWERBRO_DATA_KEY=" + testKey,
                "--FLOWERBRO_ORIGIN=", "--NODE_ENV=test", "--spring.profiles.active=test")) {
            int port = ((WebServerApplicationContext) context).getWebServer().getPort();
            String origin = "http://127.0.0.1:" + port;
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
