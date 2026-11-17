package it.flowerbro.store;

import it.flowerbro.security.PersonalDataCrypto;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Properties;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
class StoreDatabase {
    private final PGSimpleDataSource dataSource = new PGSimpleDataSource();
    private final Path cryptoFile;
    private final String orderKey;
    private final String lookupKey;

    StoreDatabase(Environment environment) {
        Path backend = Files.isRegularFile(Path.of("backend", "compose.yaml")) ? Path.of("backend") : Path.of(".");
        Path localCert = backend.resolve(".tls").resolve("ca.crt").toAbsolutePath().normalize();
        cryptoFile = backend.resolve(".env.crypto");
        orderKey = environment.getProperty("FLOWERBRO_ORDER_DATA_KEY");
        lookupKey = environment.getProperty("FLOWERBRO_EMAIL_LOOKUP_KEY");

        dataSource.setServerNames(new String[] { environment.getProperty("FLOWERBRO_DB_HOST", "127.0.0.1") });
        dataSource.setPortNumbers(new int[] { environment.getProperty("FLOWERBRO_DB_PORT", Integer.class, 5433) });
        dataSource.setDatabaseName(environment.getProperty("FLOWERBRO_DB_NAME", "flowerbro"));
        dataSource.setUser(environment.getProperty("FLOWERBRO_APP_DB_USER", "flowerbro_app"));
        dataSource.setPassword(environment.getProperty("FLOWERBRO_APP_DB_PASSWORD"));
        dataSource.setSslMode("verify-full");
        dataSource.setSslRootCert(environment.getProperty("FLOWERBRO_DB_CA_CERT", localCert.toString()));
        dataSource.setConnectTimeout(4);
        dataSource.setLoginTimeout(5);
        dataSource.setSocketTimeout(8);
    }

    Connection open() throws SQLException {
        if (dataSource.getPassword() == null || dataSource.getPassword().isBlank()) {
            throw new SQLException("FLOWERBRO_APP_DB_PASSWORD is missing", "08001");
        }
        return dataSource.getConnection();
    }

    PersonalDataCrypto deliveryCrypto() throws IOException {
        Properties local = new Properties();
        if (orderKey == null || lookupKey == null) {
            // The SQLite account key has the same name in its own configuration file.
            try (var input = Files.newInputStream(cryptoFile)) {
                local.load(input);
            }
        }
        String encryption = orderKey == null ? local.getProperty("FLOWERBRO_DATA_KEY") : orderKey;
        String lookup = lookupKey == null ? local.getProperty("FLOWERBRO_EMAIL_LOOKUP_KEY") : lookupKey;
        if (encryption == null || lookup == null) {
            throw new IOException("Order encryption keys are missing");
        }
        try {
            return new PersonalDataCrypto(encryption, lookup);
        } catch (IllegalArgumentException invalidKey) {
            throw new IOException("Invalid order encryption configuration");
        }
    }
}
