package pe.gob.saip.backend.service.notification;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TokenPushProtector {

    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private final byte[] encryptionKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public TokenPushProtector(
            @Value("${app.notifications.push.token-encryption-key-base64:}") String encryptionKeyBase64) {
        this.encryptionKey = decodeValidKey(encryptionKeyBase64);
    }

    public String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return toHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("No se pudo calcular el hash seguro del token push", exception);
        }
    }

    public String cifrar(String token) {
        return cifrarSiDisponible(token);
    }

    public String cifrarSiDisponible(String token) {
        if (!cifradoDisponible()) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
            byte[] output = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, output, 0, iv.length);
            System.arraycopy(ciphertext, 0, output, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(output);
        } catch (Exception exception) {
            throw new IllegalStateException("No se pudo cifrar el token push", exception);
        }
    }

    public String descifrarSiDisponible(String tokenCifrado) {
        if (!cifradoDisponible() || tokenCifrado == null || tokenCifrado.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(tokenCifrado);
            if (decoded.length <= GCM_IV_BYTES) {
                throw new IllegalArgumentException("Token cifrado malformado");
            }
            byte[] iv = new byte[GCM_IV_BYTES];
            System.arraycopy(decoded, 0, iv, 0, GCM_IV_BYTES);
            byte[] ciphertext = new byte[decoded.length - GCM_IV_BYTES];
            System.arraycopy(decoded, GCM_IV_BYTES, ciphertext, 0, ciphertext.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKey, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] decrypted = cipher.doFinal(ciphertext);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("No se pudo descifrar el token push", exception);
        }
    }

    public boolean cifradoDisponible() {
        return encryptionKey != null;
    }

    private static byte[] decodeValidKey(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(value);
            return decoded.length == 16 || decoded.length == 24 || decoded.length == 32 ? decoded : null;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
