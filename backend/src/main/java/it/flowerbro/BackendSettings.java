package it.flowerbro;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;

import org.springframework.core.env.Environment;

public record BackendSettings(URI publicOrigin, Path databasePath, byte[] dataKey) {
    public BackendSettings {
        dataKey = dataKey.clone();
    }

    @Override
    public byte[] dataKey() {
        return dataKey.clone();
    }

    static BackendSettings load(Environment environment) {
        URI origin = readOrigin(environment.getProperty("FLOWERBRO_ORIGIN"));
        boolean production = "production".equals(environment.getProperty("NODE_ENV"))
                || environment.matchesProfiles("production");
        if (production && origin == null) {
            throw new IllegalStateException("FLOWERBRO_ORIGIN è obbligatorio in produzione.");
        }

        Path workingDirectory = Path.of("").toAbsolutePath().normalize();
        Path frontend = workingDirectory.resolve("frontend");
        if (!Files.isDirectory(frontend)) {
            frontend = workingDirectory.resolveSibling("frontend");
        }

        String configuredPath = environment.getProperty("FLOWERBRO_DB_PATH");
        Path database = configuredPath == null || configuredPath.isBlank()
                ? null
                : Path.of(configuredPath);
        if (origin != null && (database == null || !database.isAbsolute())) {
            throw new IllegalStateException("FLOWERBRO_DB_PATH deve essere un percorso assoluto in produzione.");
        }
        if (database == null) {
            database = frontend.resolveSibling(".flowerbro").resolve("auth.sqlite");
        }
        database = database.toAbsolutePath().normalize();
        if (database.startsWith(frontend)) {
            throw new IllegalStateException("Il database deve trovarsi fuori dalla directory del frontend.");
        }

        return new BackendSettings(origin, database, readKey(environment.getProperty("FLOWERBRO_DATA_KEY")));
    }

    private static URI readOrigin(String configured) {
        if (configured == null || configured.isEmpty()) {
            return null;
        }
        URI origin;
        try {
            origin = URI.create(configured);
        } catch (IllegalArgumentException ignored) {
            throw invalidOrigin();
        }
        if (!"https".equals(origin.getScheme()) || origin.getHost() == null
                || origin.getUserInfo() != null || origin.getRawQuery() != null
                || origin.getRawFragment() != null || !origin.getRawPath().isEmpty()
                || origin.getPort() == 443 || origin.getPort() == 0 || origin.getPort() > 65535
                || !configured.equals("https://" + origin.getHost().toLowerCase(java.util.Locale.ROOT)
                        + (origin.getPort() < 0 ? "" : ":" + origin.getPort()))) {
            throw invalidOrigin();
        }
        return origin;
    }

    private static IllegalStateException invalidOrigin() {
        return new IllegalStateException("FLOWERBRO_ORIGIN deve essere l’origine HTTPS, senza percorso.");
    }

    private static byte[] readKey(String encoded) {
        if (encoded != null && encoded.length() == 43) {
            try {
                byte[] key = Base64.getUrlDecoder().decode(encoded);
                if (key.length == 32 && encoded.equals(Base64.getUrlEncoder().withoutPadding().encodeToString(key))) {
                    return key;
                }
            } catch (IllegalArgumentException ignored) {
                // Do not include any part of the secret in startup errors.
            }
        }
        throw new IllegalStateException("FLOWERBRO_DATA_KEY deve contenere una chiave base64url di 32 byte.");
    }
}
