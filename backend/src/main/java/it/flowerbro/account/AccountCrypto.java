package it.flowerbro.account;

import org.bouncycastle.crypto.generators.SCrypt;
import tools.jackson.databind.json.JsonMapper;

import javax.crypto.Cipher;
import javax.crypto.KDF;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.HKDFParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.regex.Pattern;

import static java.nio.charset.StandardCharsets.US_ASCII;
import static java.nio.charset.StandardCharsets.UTF_8;

final class AccountCrypto {
    private static final int NONCE_SIZE = 12;
    private static final int TAG_SIZE = 16;
    private static final String HMAC = "HmacSHA256";
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final Pattern SESSION_TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");
    private static final Pattern UNPAIRED_SURROGATE = Pattern.compile("\\p{Cs}");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final SecureRandom random = new SecureRandom();
    private final SecretKeySpec profileKey;
    private final SecretKeySpec emailKey;

    AccountCrypto(byte[] rootKey) {
        profileKey = new SecretKeySpec(deriveKey(rootKey, "flowerbro/auth/profile-encryption/v1"), "AES");
        emailKey = new SecretKeySpec(deriveKey(rootKey, "flowerbro/auth/email-lookup/v1"), HMAC);
    }

    static byte[] keyCheck(byte[] rootKey) {
        return deriveKey(rootKey, "flowerbro/auth/database-key-check/v1");
    }

    byte[] emailLookup(String email) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(emailKey);
            return mac.doFinal(nodeUtf8(email));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Impossibile calcolare l'indice dell'account.", error);
        }
    }

    byte[] encryptProfile(AccountStore.Profile profile, byte[] lookup) {
        byte[] nonce = randomBytes(NONCE_SIZE);
        byte[] plaintext = JSON.writeValueAsBytes(profile);
        try {
            var cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, profileKey, new GCMParameterSpec(TAG_SIZE * 8, nonce));
            cipher.updateAAD(lookup);
            byte[] ciphertextWithTag = cipher.doFinal(plaintext);
            int ciphertextSize = ciphertextWithTag.length - TAG_SIZE;
            // The existing database stores the tag before the ciphertext.
            return ByteBuffer.allocate(NONCE_SIZE + ciphertextWithTag.length)
                    .put(nonce)
                    .put(ciphertextWithTag, ciphertextSize, TAG_SIZE)
                    .put(ciphertextWithTag, 0, ciphertextSize)
                    .array();
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Impossibile cifrare il profilo.", error);
        } finally {
            Arrays.fill(plaintext, (byte) 0);
        }
    }

    AccountStore.Profile decryptProfile(byte[] encrypted, byte[] lookup) {
        int ciphertextSize = encrypted.length - NONCE_SIZE - TAG_SIZE;
        if (ciphertextSize <= 0) throw new IllegalStateException("Profilo cifrato non valido.");

        byte[] ciphertextWithTag = ByteBuffer.allocate(ciphertextSize + TAG_SIZE)
                .put(encrypted, NONCE_SIZE + TAG_SIZE, ciphertextSize)
                .put(encrypted, NONCE_SIZE, TAG_SIZE)
                .array();
        try {
            var cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, profileKey, new GCMParameterSpec(TAG_SIZE * 8, encrypted, 0, NONCE_SIZE));
            cipher.updateAAD(lookup);
            byte[] plaintext = cipher.doFinal(ciphertextWithTag);
            try {
                return JSON.readValue(plaintext, AccountStore.Profile.class);
            } finally {
                Arrays.fill(plaintext, (byte) 0);
            }
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("Impossibile decifrare il profilo.", error);
        }
    }

    static byte[] passwordHash(String password, byte[] salt) {
        byte[] passwordBytes = nodeUtf8(password);
        try {
            return SCrypt.generate(passwordBytes, salt, 1 << 15, 8, 3, 32);
        } finally {
            Arrays.fill(passwordBytes, (byte) 0);
        }
    }

    String newToken() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(32));
    }

    static byte[] tokenHash(String token) {
        if (token == null || !SESSION_TOKEN.matcher(token).matches()) return null;

        try {
            return MessageDigest.getInstance("SHA-256").digest(token.getBytes(US_ASCII));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 non disponibile.", error);
        }
    }

    byte[] randomBytes(int count) {
        byte[] bytes = new byte[count];
        random.nextBytes(bytes);
        return bytes;
    }

    private static byte[] deriveKey(byte[] key, String purpose) {
        try {
            var parameters = HKDFParameterSpec.ofExtract()
                    .addIKM(key)
                    .thenExpand(purpose.getBytes(UTF_8), 32);
            return KDF.getInstance("HKDF-SHA256").deriveData(parameters);
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("HKDF-SHA256 non disponibile.", error);
        }
    }

    private static byte[] nodeUtf8(String value) {
        // Match the UTF-8 conversion used to write the existing database.
        return UNPAIRED_SURROGATE.matcher(value).replaceAll("\uFFFD").getBytes(UTF_8);
    }
}
