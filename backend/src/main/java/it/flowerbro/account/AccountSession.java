package it.flowerbro.account;

public record AccountSession(AccountProfile profile, String token) {
    static final long LIFETIME_SECONDS = 7 * 24 * 60 * 60;
}
