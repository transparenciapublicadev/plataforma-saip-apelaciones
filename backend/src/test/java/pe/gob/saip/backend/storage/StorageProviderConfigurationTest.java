package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.config.StorageProviderTypeConverter;

class StorageProviderConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(StorageTestConfiguration.class)
            .withPropertyValues(
                    "app.storage.max-file-size=1024",
                    "app.storage.allowed-content-types=application/pdf,image/png,image/jpeg,text/plain");

    @Test
    void localRemainsDefaultProvider() {
        contextRunner
                .withPropertyValues(
                        "app.storage.local.base-path="
                                + System.getProperty("java.io.tmpdir") + "/saip-storage-context-test")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(LocalStorageProvider.class);
                    assertThat(context).doesNotHaveBean(S3CompatibleStorageProvider.class);
                    assertThat(context.getBean(StorageProperties.class).getProvider())
                            .isEqualTo(StorageProviderType.LOCAL);
                });
    }

    @Test
    void s3AliasSelectsS3CompatibleProvider() {
        contextRunner
                .withPropertyValues(
                        "app.storage.provider=s3-compatible",
                        "app.storage.s3.endpoint=https://storage.example.test",
                        "app.storage.s3.region=us-east-1",
                        "app.storage.s3.bucket=saip-documents-test",
                        "app.storage.s3.access-key=test-only-not-a-real-access-key",
                        "app.storage.s3.secret-key=test-only-not-a-real-secret-key",
                        "app.storage.s3.force-path-style=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(S3CompatibleStorageProvider.class);
                    assertThat(context).doesNotHaveBean(LocalStorageProvider.class);
                    assertThat(context.getBean(StorageProperties.class).getProvider())
                            .isEqualTo(StorageProviderType.S3_COMPATIBLE);
                });
    }

    @Test
    void s3FailsClearlyWhenRequiredConfigurationIsMissing() {
        contextRunner
                .withPropertyValues("app.storage.provider=s3")
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseMessage(
                                    "APP_STORAGE_S3_ENDPOINT es obligatoria cuando APP_STORAGE_PROVIDER=s3");
                });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(StorageProperties.class)
    @Import({
            StorageProviderTypeConverter.class,
            StorageUploadValidator.class,
            LocalStorageProvider.class,
            S3CompatibleStorageProvider.class
    })
    static class StorageTestConfiguration {
    }
}
