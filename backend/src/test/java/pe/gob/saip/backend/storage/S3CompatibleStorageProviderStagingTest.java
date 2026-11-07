package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@SpringBootTest(properties = {
    "SUPABASE_S3_ENDPOINT=https://mock-s3-endpoint.com",
    "AWS_REGION=us-east-1",
    "SUPABASE_S3_BUCKET_NAME=mock-bucket",
    "SUPABASE_S3_ACCESS_KEY=mock-access-key",
    "SUPABASE_S3_SECRET_KEY=mock-secret-key",
    "spring.flyway.enabled=false"
})
@ActiveProfiles("staging")
class S3CompatibleStorageProviderStagingTest {

    @DynamicPropertySource
    static void isolatedJwt(DynamicPropertyRegistry registry) {
        String key = java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID();
        registry.add("JWT_SECRET", () -> key);
    }


    @Autowired
    private S3CompatibleStorageProvider s3StorageProvider;

    @Autowired
    private StorageProperties storageProperties;

    @Test
    void s3StorageProviderBeanIsSuccessfullyInjectedInStagingProfile() {
        // Verify that the bean is loaded in staging
        assertThat(s3StorageProvider).isNotNull();
        assertThat(s3StorageProvider.type()).isEqualTo(StorageProviderType.S3_COMPATIBLE);

        // Verify properties configuration
        assertThat(storageProperties.getProvider()).isEqualTo(StorageProviderType.S3_COMPATIBLE);
        assertThat(storageProperties.getS3().getEndpoint()).isEqualTo("https://mock-s3-endpoint.com");
        assertThat(storageProperties.getS3().getRegion()).isEqualTo("us-east-1");
        assertThat(storageProperties.getS3().getBucket()).isEqualTo("mock-bucket");
        assertThat(storageProperties.getS3().getAccessKey()).isEqualTo("mock-access-key");
        assertThat(storageProperties.getS3().getSecretKey()).isEqualTo("mock-secret-key");
        assertThat(storageProperties.getS3().isForcePathStyle()).isTrue();

        // Verify multipart and max file size properties are set to 10MB
        assertThat(storageProperties.getMaxFileSize()).isEqualTo(10485760L);
    }

    @Test
    void exceptionIsolationTranslatesNativeS3ErrorsToDomainStorageException() {
        // Create a mock S3Client and temporarily override the bean instance
        S3Client mockS3Client = mock(S3Client.class);
        Object originalS3Client = ReflectionTestUtils.getField(s3StorageProvider, "s3Client");
        try {
            ReflectionTestUtils.setField(s3StorageProvider, "s3Client", mockS3Client);

            // Configure mock client to throw S3Exception (AWS SDK native exception) during upload
            when(mockS3Client.putObject(any(PutObjectRequest.class), any(software.amazon.awssdk.core.sync.RequestBody.class)))
                    .thenThrow(S3Exception.builder()
                            .statusCode(403)
                            .message("Access Denied on Staging Supabase bucket")
                            .build());

            byte[] content = "Dummy file content".getBytes(StandardCharsets.UTF_8);
            StorageUploadRequest uploadRequest = new StorageUploadRequest(
                    "document.txt",
                    "text/plain",
                    content.length,
                    new ByteArrayInputStream(content)
            );

            // Assert that the native S3Exception is wrapped safely in StorageException (Reason.IO_ERROR)
            assertThatThrownBy(() -> s3StorageProvider.upload(uploadRequest))
                    .isInstanceOf(StorageException.class)
                    .hasMessageContaining("No fue posible almacenar el documento")
                    .extracting(ex -> ((StorageException) ex).getReason())
                    .isEqualTo(StorageException.Reason.IO_ERROR);

            // Configure mock client to throw S3Exception during download
            when(mockS3Client.getObject(any(GetObjectRequest.class)))
                    .thenThrow(S3Exception.builder()
                            .statusCode(500)
                            .message("Internal server error inside AWS S3 compatible provider")
                            .build());

            // Assert that the native exception is wrapped during download
            assertThatThrownBy(() -> s3StorageProvider.download("2026/06/some-key.txt", "text/plain"))
                    .isInstanceOf(StorageException.class)
                    .hasMessageContaining("No fue posible abrir el documento almacenado")
                    .extracting(ex -> ((StorageException) ex).getReason())
                    .isEqualTo(StorageException.Reason.IO_ERROR);

        } finally {
            // Restore original S3Client
            ReflectionTestUtils.setField(s3StorageProvider, "s3Client", originalS3Client);
        }
    }

    @Test
    void pathTraversalIsMitigatedDuringUploadAndDownload() {
        byte[] content = "Dummy text file".getBytes(StandardCharsets.UTF_8);

        // Upload traversal mitigation: originalFilename contains path traversal sequences
        StorageUploadRequest traversalUpload = new StorageUploadRequest(
                "../../malicious_file.txt",
                "text/plain",
                content.length,
                new ByteArrayInputStream(content)
        );

        // Upload must throw INVALID_INPUT immediately before S3 client is hit
        assertThatThrownBy(() -> s3StorageProvider.upload(traversalUpload))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("El nombre original del archivo contiene una ruta no permitida")
                .extracting(ex -> ((StorageException) ex).getReason())
                .isEqualTo(StorageException.Reason.INVALID_INPUT);

        // Download traversal mitigation: storageKey contains traversal sequences
        assertThatThrownBy(() -> s3StorageProvider.download("2026/06/../../../secret.txt", "text/plain"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("La clave de almacenamiento contiene una ruta no permitida")
                .extracting(ex -> ((StorageException) ex).getReason())
                .isEqualTo(StorageException.Reason.INVALID_INPUT);
    }

    @Test
    void integrityOfDownloadStreamAndMetadataAreVerified() throws Exception {
        S3Client mockS3Client = mock(S3Client.class);
        Object originalS3Client = ReflectionTestUtils.getField(s3StorageProvider, "s3Client");
        try {
            ReflectionTestUtils.setField(s3StorageProvider, "s3Client", mockS3Client);

            byte[] expectedContent = "Verified storage download flow content".getBytes(StandardCharsets.UTF_8);
            GetObjectResponse getResponse = GetObjectResponse.builder()
                    .contentLength((long) expectedContent.length)
                    .build();

            when(mockS3Client.getObject(any(GetObjectRequest.class)))
                    .thenReturn(new ResponseInputStream<>(
                            getResponse,
                            new ByteArrayInputStream(expectedContent)
                    ));

            // Execute download
            StorageDownloadResult result = s3StorageProvider.download("2026/06/test-key.txt", "text/plain");

            // Verify integrity of result and stream content
            assertThat(result.sizeBytes()).isEqualTo(expectedContent.length);
            assertThat(result.contentType()).isEqualTo("text/plain");
            try (InputStream stream = result.content()) {
                byte[] downloadedBytes = stream.readAllBytes();
                assertThat(downloadedBytes).isEqualTo(expectedContent);
            }

        } finally {
            ReflectionTestUtils.setField(s3StorageProvider, "s3Client", originalS3Client);
        }
    }

    @Test
    void docMetadataDTONeverExposesInfrastructureDetails() {
        // Assert via Reflection that fields like storageKey, bucket, endpoint, provider do not exist in DTO
        java.lang.reflect.Field[] fields = DocumentoMetadataDTO.class.getDeclaredFields();
        for (java.lang.reflect.Field field : fields) {
            String name = field.getName();
            assertThat(name)
                .isNotEqualToIgnoringCase("storageKey")
                .isNotEqualToIgnoringCase("storageProvider")
                .isNotEqualToIgnoringCase("bucket")
                .isNotEqualToIgnoringCase("endpoint")
                .isNotEqualToIgnoringCase("rutaFisica")
                .isNotEqualToIgnoringCase("rutaArchivo")
                .isNotEqualToIgnoringCase("provider");
        }
    }
}
