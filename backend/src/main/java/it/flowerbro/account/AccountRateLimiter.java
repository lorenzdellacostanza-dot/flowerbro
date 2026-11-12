package it.flowerbro.account;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

final class AccountRateLimiter {

    static final long WINDOW_SECONDS = 15 * 60;
    private static final long WINDOW_NANOS = Duration.ofSeconds(WINDOW_SECONDS).toNanos();
    private static final long CLEANUP_INTERVAL_NANOS = Duration.ofMinutes(1).toNanos();
    private static final int MAX_ENTRIES = 20_000;

    private final Map<String, Window> attempts = new HashMap<>();
    private long lastCleanup = System.nanoTime();

    synchronized boolean takeAttempt(String key, int limit) {
        long now = System.nanoTime();
        if (now - lastCleanup >= CLEANUP_INTERVAL_NANOS) {
            attempts.values().removeIf(window -> window.expired(now));
            lastCleanup = now;
        }

        Window previous = attempts.get(key);
        if (previous == null && attempts.size() >= MAX_ENTRIES) {
            return false;
        }
        Window current = previous == null || previous.expired(now) ? new Window(now, 0) : previous;
        if (current.count() >= limit) {
            return false;
        }
        attempts.put(key, new Window(current.startedAt(), current.count() + 1));
        return true;
    }

    synchronized void reset(String key) {
        attempts.remove(key);
    }

    private record Window(long startedAt, int count) {
        boolean expired(long now) {
            return now - startedAt >= WINDOW_NANOS;
        }
    }
}
