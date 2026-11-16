package it.flowerbro.account;

import java.util.Locale;
import java.util.regex.Pattern;

public record AccountProfile(String name, String email) {
    private static final String JS_WHITESPACE = "[\\p{Zs}\\t\\x0B\\f\\r\\n\\u2028\\u2029\\uFEFF]";
    private static final Pattern EMAIL_TRIM = Pattern.compile(
            "\\A" + JS_WHITESPACE + "+|" + JS_WHITESPACE + "+\\z");

    static String normalizeEmail(String email) {
        return EMAIL_TRIM.matcher(email).replaceAll("").toLowerCase(Locale.ROOT);
    }
}
