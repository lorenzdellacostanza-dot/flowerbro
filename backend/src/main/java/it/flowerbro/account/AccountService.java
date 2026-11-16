package it.flowerbro.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Optional;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class AccountService {
    private static final int MAX_CONCURRENT_AUTH = 4;
    private static final String NON_EMAIL_CHARACTERS = "\\s@<>\\x00-\\x1f\\x7f"
            + "\\x{00a0}\\x{1680}\\x{2000}-\\x{200a}\\x{2028}\\x{2029}\\x{202f}\\x{205f}\\x{3000}\\x{feff}";
    private static final String EMAIL_PART = "[^" + NON_EMAIL_CHARACTERS + "]+";
    private static final Pattern EMAIL = Pattern.compile(EMAIL_PART + "@" + EMAIL_PART + "\\." + EMAIL_PART);
    private static final Pattern NAME_CONTROL = Pattern.compile("[\\x00-\\x1f\\x7f]");

    private final AccountStore store;
    private final AccountRateLimiter attempts = new AccountRateLimiter();
    private final Semaphore authSlots = new Semaphore(MAX_CONCURRENT_AUTH);

    public AccountService(AccountStore store) {
        this.store = store;
    }

    Optional<AccountProfile> profile(String token) {
        return store.profile(token);
    }

    void signOut(String token) {
        store.signOut(token);
    }

    AccountSession register(String name, String email, String password, String previousToken, String ip) {
        String normalizedEmail = validateCredentials(email, password);
        String trimmedName = name.strip();
        if (trimmedName.isEmpty() || trimmedName.length() > 80 || !wellFormed(trimmedName)
                || NAME_CONTROL.matcher(trimmedName).find() || !wellFormed(password)
                || password.codePointCount(0, password.length()) < 15) {
            throw new AuthenticationRejected(Failure.INVALID_REGISTRATION);
        }

        acquireAuthSlot();
        try {
            recordAttempt("register:ip:" + ip, 10);
            return store.register(new AccountProfile(trimmedName, normalizedEmail), password, previousToken)
                    .orElseThrow(() -> new AuthenticationRejected(Failure.REGISTRATION_CONFLICT));
        } finally {
            authSlots.release();
        }
    }

    AccountSession signIn(String email, String password, String previousToken, String ip) {
        String normalizedEmail = validateCredentials(email, password);
        acquireAuthSlot();
        try {
            String emailKey = "login:email:" + emailDigest(normalizedEmail);
            recordAttempt("login:ip:" + ip, 25);
            recordAttempt(emailKey, 8);
            AccountSession session = store.signIn(normalizedEmail, password, previousToken)
                    .orElseThrow(() -> new AuthenticationRejected(Failure.INCORRECT_CREDENTIALS));
            attempts.reset(emailKey);
            return session;
        } finally {
            authSlots.release();
        }
    }

    private void acquireAuthSlot() {
        if (!authSlots.tryAcquire()) {
            throw new AuthenticationRejected(Failure.AUTH_BUSY);
        }
    }

    private void recordAttempt(String key, int limit) {
        if (!attempts.takeAttempt(key, limit)) {
            throw new AuthenticationRejected(Failure.ATTEMPTS_EXHAUSTED);
        }
    }

    private static String validateCredentials(String email, String password) {
        String normalizedEmail = AccountProfile.normalizeEmail(email);
        if (normalizedEmail.length() > 254 || !wellFormed(normalizedEmail) || !EMAIL.matcher(normalizedEmail).matches()
                || password.isEmpty() || password.length() > 128) {
            throw new AuthenticationRejected(Failure.INVALID_CREDENTIALS);
        }
        return normalizedEmail;
    }

    private static String emailDigest(String email) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(email.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException missingAlgorithm) {
            throw new IllegalStateException("SHA-256 is unavailable", missingAlgorithm);
        }
    }

    private static boolean wellFormed(String value) {
        return value.codePoints().noneMatch(c -> c >= Character.MIN_SURROGATE && c <= Character.MAX_SURROGATE);
    }

    enum Failure {
        INVALID_CREDENTIALS,
        INVALID_REGISTRATION,
        REGISTRATION_CONFLICT,
        INCORRECT_CREDENTIALS,
        AUTH_BUSY(2),
        ATTEMPTS_EXHAUSTED(AccountRateLimiter.WINDOW_SECONDS);

        private final long retryAfterSeconds;

        Failure() {
            this(0);
        }

        Failure(long retryAfterSeconds) {
            this.retryAfterSeconds = retryAfterSeconds;
        }

        long retryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    static final class AuthenticationRejected extends RuntimeException {
        private final Failure failure;

        AuthenticationRejected(Failure failure) {
            super(failure.name());
            this.failure = failure;
        }

        Failure failure() {
            return failure;
        }
    }
}
