package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import pe.gob.saip.backend.config.StorageProperties;
import software.amazon.awssdk.services.s3.S3Client;

@EnabledIfEnvironmentVariable(
        named = "RUN_S3_STORAGE_INTEGRATION_TESTS",
        matches = "(?i)true")
class S3CompatibleStorageProviderIntegrationTest {

    private static final List<String> REQUIRED_VARIABLES = List.of(
            "APP_STORAGE_PROVIDER",
            "APP_STORAGE_S3_ENDPOINT",
            "APP_STORAGE_S3_REGION",
            "APP_STORAGE_S3_BUCKET",
            "APP_STORAGE_S3_ACCESS_KEY",
            "APP_STORAGE_S3_SECRET_KEY",
            "APP_STORAGE_S3_FORCE_PATH_STYLE");

    @Test
    void uploadsDownloadsVerifiesAndDeletesControlledObject() throws Throwable {
        StorageProperties properties = propertiesFromEnvironment();
        String prefix = testPrefix();
        byte[] content = ("SAIP S3 integration validation " + UUID.randomUUID())
                .getBytes(StandardCharsets.UTF_8);
        String expectedHash = sha256(content);
        String createdKey = null;
        Throwable testFailure = null;

        S3Client client = S3CompatibleStorageProvider.buildClient(properties);
        S3CompatibleStorageProvider provider = new S3CompatibleStorageProvider(
                properties,
                new StorageUploadValidator(properties),
                client,
                extension -> prefix + "/" + UUID.randomUUID() + "." + extension);

        try {
            StorageObjectMetadata metadata = provider.upload(new StorageUploadRequest(
                            "s3-integration-test.txt",
                            "text/plain",
                            content.length,
                            new ByteArrayInputStream(content)))
                    .metadata();
            createdKey = metadata.storageKey();

            assertThat(metadata.storageKey())
                    .startsWith(prefix + "/")
                    .matches(java.util.regex.Pattern.quote(prefix)
                            + "/[0-9a-f-]{36}\\.txt");
            assertThat(metadata.hashSha256()).isEqualTo(expectedHash);
            assertThat(provider.exists(metadata.storageKey())).isTrue();

            StorageDownloadResult download = provider.download(
                    metadata.storageKey(),
                    metadata.contentType());
            byte[] downloaded;
            try (var stream = download.content()) {
                downloaded = stream.readAllBytes();
            }
            assertThat(downloaded).isEqualTo(content);
            assertThat(sha256(downloaded)).isEqualTo(expectedHash);

            provider.delete(metadata.storageKey());
            assertThat(provider.exists(metadata.storageKey())).isFalse();
            createdKey = null;
        } catch (StorageException exception) {
            testFailure = new AssertionError(
                    "La validación S3 opt-in falló; revise conectividad, permisos y configuración externa");
            throw testFailure;
        } catch (Throwable failure) {
            testFailure = failure;
            throw failure;
        } finally {
            cleanup(provider, createdKey, testFailure);
        }
    }

    private static StorageProperties propertiesFromEnvironment() {
        List<String> missing = new ArrayList<>();
        for (String variable : REQUIRED_VARIABLES) {
            if (environment(variable).isBlank()) {
                missing.add(variable);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Faltan variables obligatorias para la validación S3 opt-in: "
                            + String.join(", ", missing));
        }

        String configuredProvider = environment("APP_STORAGE_PROVIDER")
                .strip()
                .toLowerCase(Locale.ROOT);
        if (!configuredProvider.equals("s3")) {
            throw new IllegalStateException(
                    "APP_STORAGE_PROVIDER debe ser s3 para la validación S3 opt-in");
        }

        String forcePathStyleValue = environment("APP_STORAGE_S3_FORCE_PATH_STYLE")
                .strip()
                .toLowerCase(Locale.ROOT);
        if (!Set.of("true", "false").contains(forcePathStyleValue)) {
            throw new IllegalStateException(
                    "APP_STORAGE_S3_FORCE_PATH_STYLE debe ser true o false");
        }

        StorageProperties properties = new StorageProperties();
        properties.setProvider(StorageProviderType.S3_COMPATIBLE);
        properties.setMaxFileSize(1024);
        properties.setAllowedContentTypes(Set.of("text/plain"));
        properties.getS3().setEndpoint(environment("APP_STORAGE_S3_ENDPOINT"));
        properties.getS3().setRegion(environment("APP_STORAGE_S3_REGION"));
        properties.getS3().setBucket(environment("APP_STORAGE_S3_BUCKET"));
        properties.getS3().setAccessKey(environment("APP_STORAGE_S3_ACCESS_KEY"));
        properties.getS3().setSecretKey(environment("APP_STORAGE_S3_SECRET_KEY"));
        properties.getS3().setForcePathStyle(Boolean.parseBoolean(forcePathStyleValue));
        return properties;
    }

    private static String testPrefix() {
        String configured = environment("APP_STORAGE_S3_TEST_PREFIX");
        String prefix = configured.isBlank() ? "integration-tests" : configured.strip();
        StorageObjectKey.requireSafe(prefix + "/probe.txt");
        return prefix;
    }

    private static void cleanup(
            S3CompatibleStorageProvider provider,
            String storageKey,
            Throwable testFailure) {
        RuntimeException cleanupFailure = null;
        try {
            if (storageKey != null && provider.exists(storageKey)) {
                provider.delete(storageKey);
            }
        } catch (RuntimeException exception) {
            cleanupFailure = new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "No fue posible limpiar el objeto temporal de la validación S3");
        }

        try {
            provider.close();
        } catch (RuntimeException exception) {
            if (cleanupFailure == null) {
                cleanupFailure = new StorageException(
                        StorageException.Reason.IO_ERROR,
                        "No fue posible cerrar el cliente de la validación S3");
            } else {
                cleanupFailure.addSuppressed(exception);
            }
        }

        if (cleanupFailure != null) {
            if (testFailure != null) {
                testFailure.addSuppressed(cleanupFailure);
            } else {
                throw cleanupFailure;
            }
        }
    }

    private static String environment(String name) {
        String value = System.getenv(name);
        return value == null ? "" : value;
    }

    private static String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(content));
    }
}
