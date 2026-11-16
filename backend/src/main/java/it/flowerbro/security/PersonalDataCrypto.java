package it.flowerbro.security;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.Locale;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Encrypts personal fields before they are sent to PostgreSQL. */
public final class PersonalDataCrypto {
    private static final byte FORMAT_VERSION = 1;
    private static final int KEY_BYTES = 32;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BYTES = 16;
    private static final int HEADER_BYTES = 1 + NONCE_BYTES;
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final String HMAC = "HmacSHA256";

    private final SecretKeySpec encryptionKey;
    private final SecretKeySpec emailLookupKey;
    private final SecureRandom random = new SecureRandom();

    public PersonalDataCrypto(String encryptionKeyBase64, String emailLookupKeyBase64) {
        byte[] encryption = decodeKey(encryptionKeyBase64);
        byte[] lookup = decodeKey(emailLookupKeyBase64);
        if (MessageDigest.isEqual(encryption, lookup)) {
            throw new IllegalArgumentException("Use separate keys for encryption and email lookup");
        }

        this.encryptionKey = new SecretKeySpec(encryption, "AES");
        this.emailLookupKey = new SecretKeySpec(lookup, HMAC);
    }

    public byte[] encrypt(Field field, String plaintext) throws GeneralSecurityException {
        if (plaintext.isEmpty()) {
            throw new IllegalArgumentException("An encrypted field cannot be empty");
        }

        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        Cipher cipher = createCipher(Cipher.ENCRYPT_MODE, field, nonce);
        byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        return ByteBuffer.allocate(HEADER_BYTES + ciphertext.length)
            .put(FORMAT_VERSION)
            .put(nonce)
            .put(ciphertext)
            .array();
    }

    public String decrypt(Field field, byte[] payload) throws GeneralSecurityException {
        if (payload.length <= HEADER_BYTES + TAG_BYTES || payload[0] != FORMAT_VERSION) {
            throw new IllegalArgumentException("Unknown encrypted field format");
        }

        byte[] nonce = Arrays.copyOfRange(payload, 1, HEADER_BYTES);
        Cipher cipher = createCipher(Cipher.DECRYPT_MODE, field, nonce);
        byte[] plaintext = cipher.doFinal(payload, HEADER_BYTES, payload.length - HEADER_BYTES);
        return new String(plaintext, StandardCharsets.UTF_8);
    }

    public byte[] emailLookup(String email) throws GeneralSecurityException {
        Mac mac = Mac.getInstance(HMAC);
        mac.init(emailLookupKey);
        String normalized = email.strip().toLowerCase(Locale.ROOT);
        return mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8));
    }

    private Cipher createCipher(int mode, Field field, byte[] nonce) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(AES_GCM);
        cipher.init(mode, encryptionKey, new GCMParameterSpec(TAG_BYTES * Byte.SIZE, nonce));
        cipher.updateAAD(field.context);
        return cipher;
    }

    private static byte[] decodeKey(String value) {
        byte[] key = Base64.getDecoder().decode(value);
        if (key.length != KEY_BYTES) {
            throw new IllegalArgumentException("A 32-byte Base64 key is required");
        }
        return key;
    }

    public enum Field {
        ACCOUNT_NAME("accounts.name"),
        ACCOUNT_EMAIL("accounts.email"),
        ORDER_DELIVERY("orders.delivery");

        private final byte[] context;

        Field(String context) {
            this.context = context.getBytes(StandardCharsets.UTF_8);
        }
    }
}
