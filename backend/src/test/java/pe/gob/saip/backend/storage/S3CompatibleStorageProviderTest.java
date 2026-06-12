package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;
import java.util.function.Function;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import pe.gob.saip.backend.config.StorageProperties;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@ExtendWith(MockitoExtension.class)
class S3CompatibleStorageProviderTest {

    private static final byte[] PDF_CONTENT = "%PDF-1.4\ncontenido\n%%EOF"
            .getBytes(StandardCharsets.UTF_8);

    @Mock
    private S3Client s3Client;

    private S3CompatibleStorageProvider provider;

    @BeforeEach
    void setUp() {
        StorageProperties properties = s3Properties();
        provider = new S3CompatibleStorageProvider(
                properties,
                new StorageUploadValidator(properties),
                s3Client);
    }

    @Test
    void uploadValidatesContentAndDelegatesUsingOpaqueKey() throws Exception {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().eTag("etag").build());

        StorageObjectMetadata metadata = provider.upload(new StorageUploadRequest(
                        "resolucion.pdf",
                        "application/pdf",
                        PDF_CONTENT.length,
                        new ByteArrayInputStream(PDF_CONTENT)))
                .metadata();

        assertThat(metadata.provider()).isEqualTo(StorageProviderType.S3_COMPATIBLE);
        assertThat(metadata.bucket()).isEqualTo("saip-documents-test");
        assertThat(metadata.storageKey())
                .doesNotContain("resolucion")
                .matches("\\d{4}/\\d{2}/[0-9a-f-]{36}\\.pdf");
        assertThat(metadata.hashSha256()).isEqualTo(HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(PDF_CONTENT)));

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3Client).putObject(request.capture(), any(RequestBody.class));
        assertThat(request.getValue().bucket()).isEqualTo("saip-documents-test");
        assertThat(request.getValue().key()).isEqualTo(metadata.storageKey());
        assertThat(request.getValue().contentType()).isEqualTo("application/pdf");
        assertThat(request.getValue().metadata()).containsEntry("sha256", metadata.hashSha256());
    }

    @Test
    void uploadSupportsAnInjectedOpaqueKeyForIsolatedIntegrationTests() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenReturn(PutObjectResponse.builder().eTag("etag").build());
        StorageProperties properties = s3Properties();
        Function<String, String> keyFactory =
                extension -> "integration-tests/00000000-0000-0000-0000-000000000001." + extension;
        provider = new S3CompatibleStorageProvider(
                properties,
                new StorageUploadValidator(properties),
                s3Client,
                keyFactory);

        StorageObjectMetadata metadata = provider.upload(new StorageUploadRequest(
                        "validacion.txt",
                        "text/plain",
                        9,
                        new ByteArrayInputStream("contenido".getBytes(StandardCharsets.UTF_8))))
                .metadata();

        assertThat(metadata.storageKey())
                .isEqualTo("integration-tests/00000000-0000-0000-0000-000000000001.txt");
    }

    @Test
    void downloadAndDeleteDelegateWithoutExposingOriginalFilename() throws Exception {
        byte[] content = "contenido".getBytes(StandardCharsets.UTF_8);
        GetObjectResponse response = GetObjectResponse.builder()
                .contentLength((long) content.length)
                .build();
        when(s3Client.getObject(any(GetObjectRequest.class))).thenReturn(
                new ResponseInputStream<>(
                        response,
                        new ByteArrayInputStream(content)));
        when(s3Client.deleteObject(any(DeleteObjectRequest.class)))
                .thenReturn(DeleteObjectResponse.builder().build());

        String storageKey = "2026/06/00000000-0000-0000-0000-000000000001.txt";
        StorageDownloadResult download = provider.download(storageKey, "text/plain");
        try (var stream = download.content()) {
            assertThat(stream.readAllBytes()).isEqualTo(content);
        }
        provider.delete(storageKey);

        ArgumentCaptor<GetObjectRequest> getRequest = ArgumentCaptor.forClass(GetObjectRequest.class);
        verify(s3Client).getObject(getRequest.capture());
        assertThat(getRequest.getValue().bucket()).isEqualTo("saip-documents-test");
        assertThat(getRequest.getValue().key()).isEqualTo(storageKey);

        ArgumentCaptor<DeleteObjectRequest> deleteRequest =
                ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(s3Client).deleteObject(deleteRequest.capture());
        assertThat(deleteRequest.getValue().key()).isEqualTo(storageKey);
    }

    @Test
    void existsReturnsProviderResultAndKeepsNotFoundAsFalse() {
        String existingKey = "2026/06/00000000-0000-0000-0000-000000000001.pdf";
        String missingKey = "2026/06/00000000-0000-0000-0000-000000000002.pdf";
        when(s3Client.headObject(any(HeadObjectRequest.class)))
                .thenReturn(HeadObjectResponse.builder().build())
                .thenThrow(S3Exception.builder().statusCode(404).message("not found").build());

        assertThat(provider.exists(existingKey)).isTrue();
        assertThat(provider.exists(missingKey)).isFalse();
    }

    @Test
    void clientErrorsAreTranslatedToStorageException() {
        when(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(S3Exception.builder()
                        .statusCode(503)
                        .message("provider unavailable")
                        .build());

        assertThatThrownBy(() -> provider.upload(new StorageUploadRequest(
                "resolucion.pdf",
                "application/pdf",
                PDF_CONTENT.length,
                new ByteArrayInputStream(PDF_CONTENT))))
                .isInstanceOf(StorageException.class)
                .extracting(exception -> ((StorageException) exception).getReason())
                .isEqualTo(StorageException.Reason.IO_ERROR);
    }

    @Test
    void downloadMapsProviderNotFoundAndRejectsUnsafeKeys() {
        when(s3Client.getObject(any(GetObjectRequest.class)))
                .thenThrow(S3Exception.builder()
                        .statusCode(404)
                        .message("not found")
                        .build());

        assertThatThrownBy(() -> provider.download(
                "2026/06/00000000-0000-0000-0000-000000000001.pdf",
                "application/pdf"))
                .isInstanceOf(StorageException.class)
                .extracting(exception -> ((StorageException) exception).getReason())
                .isEqualTo(StorageException.Reason.NOT_FOUND);

        assertThatThrownBy(() -> provider.download("../secreto.pdf", "application/pdf"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("ruta no permitida");
    }

    private StorageProperties s3Properties() {
        StorageProperties properties = new StorageProperties();
        properties.setProvider(StorageProviderType.S3_COMPATIBLE);
        properties.setMaxFileSize(1024);
        properties.setAllowedContentTypes(Set.of(
                "application/pdf",
                "image/png",
                "image/jpeg",
                "text/plain"));
        properties.getS3().setEndpoint("https://storage.example.test");
        properties.getS3().setRegion("us-east-1");
        properties.getS3().setBucket("saip-documents-test");
        properties.getS3().setAccessKey("test-only-not-a-real-access-key");
        properties.getS3().setSecretKey("test-only-not-a-real-secret-key");
        properties.getS3().setForcePathStyle(true);
        return properties;
    }
}
