package it.flowerbro.account;

import org.sqlite.SQLiteConfig;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

public final class AccountStore {
    public record Profile(String name, String email) {}
    public record AuthenticatedAccount(Profile profile, String token) {}

    public static final long SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

    private static final String JS_WHITESPACE = "[\\p{Zs}\\t\\x0B\\f\\r\\n\\u2028\\u2029\\uFEFF]";
    private static final Pattern EMAIL_TRIM = Pattern.compile(
            "\\A" + JS_WHITESPACE + "+|" + JS_WHITESPACE + "+\\z");

    private final AccountCrypto crypto;
    private final String databaseUrl;
    private final SQLiteConfig sqliteConfig;
    private final byte[] dummySalt;
    private final byte[] dummyHash;

    public AccountStore(Path path, byte[] key) {
        if (key.length != 32) {
            throw new IllegalArgumentException("La chiave del database account deve contenere 32 byte.");
        }

        crypto = new AccountCrypto(key);
        dummySalt = crypto.randomBytes(16);
        dummyHash = crypto.randomBytes(32);

        Path database = path.toAbsolutePath().normalize();
        prepareDatabaseFile(database);
        databaseUrl = "jdbc:sqlite:" + database.toUri().toASCIIString();
        sqliteConfig = new SQLiteConfig();
        sqliteConfig.setBusyTimeout(5000);
        sqliteConfig.enforceForeignKeys(true);
        sqliteConfig.setTransactionMode(SQLiteConfig.TransactionMode.IMMEDIATE);
        byte[] keyCheck = AccountCrypto.keyCheck(key);
        try {
            initialize(keyCheck);
        } finally {
            Arrays.fill(keyCheck, (byte) 0);
        }
    }

    public static String normalizeEmail(String email) {
        return EMAIL_TRIM.matcher(email).replaceAll("").toLowerCase(Locale.ROOT);
    }

    public Optional<AuthenticatedAccount> register(Profile profile, String password, String previousToken) {
        var normalized = new Profile(profile.name(), normalizeEmail(profile.email()));
        byte[] lookup = crypto.emailLookup(normalized.email());
        byte[] encrypted = crypto.encryptProfile(normalized, lookup);
        byte[] salt = crypto.randomBytes(16);
        byte[] passwordHash = AccountCrypto.passwordHash(password, salt);
        try {
            return write(connection -> {
                try (var insert = connection.prepareStatement("""
                        INSERT INTO accounts (email_lookup, encrypted_profile, password_salt, password_hash)
                        VALUES (?, ?, ?, ?) ON CONFLICT (email_lookup) DO NOTHING
                        """)) {
                    insert.setBytes(1, lookup);
                    insert.setBytes(2, encrypted);
                    insert.setBytes(3, salt);
                    insert.setBytes(4, passwordHash);
                    if (insert.executeUpdate() == 0) return Optional.empty();
                }
                return Optional.of(new AuthenticatedAccount(normalized, createSession(connection, lookup, previousToken)));
            });
        } finally {
            Arrays.fill(passwordHash, (byte) 0);
        }
    }

    public Optional<AuthenticatedAccount> signIn(String email, String password, String previousToken) {
        byte[] lookup = crypto.emailLookup(normalizeEmail(email));
        Account account = read(connection -> {
            try (var select = connection.prepareStatement("""
                    SELECT encrypted_profile, password_salt, password_hash FROM accounts WHERE email_lookup = ?
                    """)) {
                select.setBytes(1, lookup);
                try (var result = select.executeQuery()) {
                    return result.next()
                            ? new Account(result.getBytes(1), result.getBytes(2), result.getBytes(3))
                            : null;
                }
            }
        });

        byte[] actual = AccountCrypto.passwordHash(password, account == null ? dummySalt : account.salt());
        try {
            boolean matches = MessageDigest.isEqual(actual, account == null ? dummyHash : account.hash());
            if (!matches || account == null) return Optional.empty();
        } finally {
            Arrays.fill(actual, (byte) 0);
            if (account != null) Arrays.fill(account.hash(), (byte) 0);
        }

        Profile profile = crypto.decryptProfile(account.encryptedProfile(), lookup);
        return write(connection -> Optional.of(
                new AuthenticatedAccount(profile, createSession(connection, lookup, previousToken))));
    }

    public Optional<Profile> profile(String token) {
        byte[] tokenHash = AccountCrypto.tokenHash(token);
        if (tokenHash == null) return Optional.empty();

        return read(connection -> {
            try (var select = connection.prepareStatement("""
                    SELECT accounts.encrypted_profile, sessions.email_lookup
                    FROM sessions JOIN accounts USING (email_lookup)
                    WHERE token_hash = ? AND expires_at > ?
                    """)) {
                select.setBytes(1, tokenHash);
                select.setLong(2, Instant.now().getEpochSecond());
                try (var result = select.executeQuery()) {
                    return result.next()
                            ? Optional.of(crypto.decryptProfile(result.getBytes(1), result.getBytes(2)))
                            : Optional.empty();
                }
            }
        });
    }

    public void signOut(String token) {
        byte[] tokenHash = AccountCrypto.tokenHash(token);
        if (tokenHash == null) return;

        write(connection -> {
            deleteSession(connection, tokenHash);
            return null;
        });
    }

    private void initialize(byte[] expectedKeyCheck) {
        write(connection -> {
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("""
                        CREATE TABLE IF NOT EXISTS accounts (
                          email_lookup BLOB PRIMARY KEY CHECK(length(email_lookup) = 32),
                          encrypted_profile BLOB NOT NULL,
                          password_salt BLOB NOT NULL CHECK(length(password_salt) = 16),
                          password_hash BLOB NOT NULL CHECK(length(password_hash) = 32)
                        ) STRICT, WITHOUT ROWID
                        """);
                statement.executeUpdate("""
                        CREATE TABLE IF NOT EXISTS sessions (
                          token_hash BLOB PRIMARY KEY CHECK(length(token_hash) = 32),
                          email_lookup BLOB NOT NULL REFERENCES accounts(email_lookup) ON DELETE CASCADE,
                          expires_at INTEGER NOT NULL
                        ) STRICT, WITHOUT ROWID
                        """);
                statement.executeUpdate("CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)");
                statement.executeUpdate("""
                        CREATE TABLE IF NOT EXISTS auth_metadata (
                          name TEXT PRIMARY KEY, value BLOB NOT NULL
                        ) STRICT, WITHOUT ROWID
                        """);
            }

            byte[] storedKeyCheck;
            try (var select = connection.createStatement();
                 var result = select.executeQuery("SELECT value FROM auth_metadata WHERE name = 'key_check'")) {
                storedKeyCheck = result.next() ? result.getBytes(1) : null;
            }
            if (storedKeyCheck == null) {
                try (var select = connection.createStatement();
                     var result = select.executeQuery("SELECT 1 FROM accounts LIMIT 1")) {
                    if (result.next()) {
                        throw new IllegalStateException("Verifica della chiave del database account assente.");
                    }
                }
                try (var insert = connection.prepareStatement("""
                        INSERT INTO auth_metadata (name, value) VALUES ('key_check', ?)
                        """)) {
                    insert.setBytes(1, expectedKeyCheck);
                    insert.executeUpdate();
                }
            } else if (!MessageDigest.isEqual(expectedKeyCheck, storedKeyCheck)) {
                throw new IllegalStateException("La chiave non corrisponde al database account esistente.");
            }

            deleteExpiredSessions(connection, Instant.now().getEpochSecond());
            return null;
        });
    }

    private String createSession(Connection connection, byte[] lookup, String previousToken) throws SQLException {
        String token = crypto.newToken();
        long now = Instant.now().getEpochSecond();
        deleteExpiredSessions(connection, now);
        byte[] previousHash = AccountCrypto.tokenHash(previousToken);
        if (previousHash != null) deleteSession(connection, previousHash);

        try (var insert = connection.prepareStatement("""
                INSERT INTO sessions (token_hash, email_lookup, expires_at) VALUES (?, ?, ?)
                """)) {
            insert.setBytes(1, AccountCrypto.tokenHash(token));
            insert.setBytes(2, lookup);
            insert.setLong(3, now + SESSION_LIFETIME_SECONDS);
            insert.executeUpdate();
        }
        return token;
    }

    private static void deleteSession(Connection connection, byte[] hash) throws SQLException {
        try (var delete = connection.prepareStatement("DELETE FROM sessions WHERE token_hash = ?")) {
            delete.setBytes(1, hash);
            delete.executeUpdate();
        }
    }

    private static void deleteExpiredSessions(Connection connection, long now) throws SQLException {
        try (var delete = connection.prepareStatement("DELETE FROM sessions WHERE expires_at <= ?")) {
            delete.setLong(1, now);
            delete.executeUpdate();
        }
    }

    private <T> T read(SqlOperation<T> operation) {
        try (var connection = DriverManager.getConnection(databaseUrl, sqliteConfig.toProperties())) {
            try (var statement = connection.createStatement()) {
                statement.execute("PRAGMA trusted_schema = OFF");
            }
            return operation.run(connection);
        } catch (SQLException error) {
            throw new IllegalStateException("Errore nel database account.", error);
        }
    }

    private <T> T write(SqlOperation<T> operation) {
        return read(connection -> {
            connection.setAutoCommit(false);
            try {
                T result = operation.run(connection);
                connection.setAutoCommit(true);
                return result;
            } catch (SQLException | RuntimeException error) {
                try {
                    if (!connection.getAutoCommit()) connection.rollback();
                } catch (SQLException rollbackError) {
                    error.addSuppressed(rollbackError);
                }
                throw error;
            }
        });
    }

    private static void prepareDatabaseFile(Path path) {
        boolean posix = path.getFileSystem().supportedFileAttributeViews().contains("posix");
        var filePermissions = PosixFilePermissions.fromString("rw-------");
        try {
            if (posix) {
                Files.createDirectories(path.getParent(),
                        PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
            } else {
                Files.createDirectories(path.getParent());
            }
            try {
                if (posix) Files.createFile(path, PosixFilePermissions.asFileAttribute(filePermissions));
                else Files.createFile(path);
            } catch (FileAlreadyExistsException ignored) {
                // An existing database must retain its account data.
            }
            if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)) {
                throw new IllegalStateException("Il percorso del database account deve essere un file regolare.");
            }
            if (posix) Files.setPosixFilePermissions(path, filePermissions);
        } catch (IOException error) {
            throw new IllegalStateException("Impossibile preparare il database account.", error);
        }
    }

    private record Account(byte[] encryptedProfile, byte[] salt, byte[] hash) {}

    @FunctionalInterface
    private interface SqlOperation<T> {
        T run(Connection connection) throws SQLException;
    }
}
