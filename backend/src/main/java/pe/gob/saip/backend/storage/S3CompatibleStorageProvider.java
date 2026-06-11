package pe.gob.saip.backend.storage;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Conditional;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;
import pe.gob.saip.backend.config.StorageProperties;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Component
@Conditional(S3StorageProviderCondition.class)
public class S3CompatibleStorageProvider implements StorageProvider {

    private final StorageUploadValidator uploadValidator;
    private final S3Client s3Client;
    private final String bucket;

    @Autowired
    public S3CompatibleStorageProvider(
            StorageProperties properties,
            StorageUploadValidator uploadValidator) {
        this(properties, uploadValidator, buildClient(properties));
    }

    S3CompatibleStorageProvider(
            StorageProperties properties,
            StorageUploadValidator uploadValidator,
            S3Client s3Client) {
        validateSettings(properties.getS3());
        this.uploadValidator = uploadValidator;
        this.s3Client = s3Client;
        this.bucket = properties.getS3().getBucket().strip();
    }

    @Override
    public StorageProviderType type() {
        return StorageProviderType.S3_COMPATIBLE;
    }

    @Override
    public StorageUploadResult upload(StorageUploadRequest request) {
        try (ValidatedStorageUpload validated = uploadValidator.validate(request)) {
            String storageKey = StorageObjectKey.create(validated.extension());
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(storageKey)
                    .contentType(validated.contentType())
                    .contentLength(validated.sizeBytes())
                    .metadata(Map.of("sha256", validated.hashSha256()))
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromFile(validated.temporaryFile()));
            return new StorageUploadResult(new StorageObjectMetadata(
                    type(),
                    bucket,
                    storageKey,
                    validated.originalFilename(),
                    validated.contentType(),
                    validated.sizeBytes(),
                    validated.hashSha256()));
        } catch (StorageException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw storageFailure("No fue posible almacenar el documento", exception);
        }
    }

    @Override
    public StorageDownloadResult download(String storageKey, String contentType) {
        String safeStorageKey = StorageObjectKey.requireSafe(storageKey);
        try {
            ResponseInputStream<GetObjectResponse> response = s3Client.getObject(
                    GetObjectRequest.builder()
                            .bucket(bucket)
                            .key(safeStorageKey)
                            .build());
            Long contentLength = response.response().contentLength();
            if (contentLength == null || contentLength < 0) {
                response.abort();
                throw new StorageException(
                        StorageException.Reason.IO_ERROR,
                        "El proveedor S3 no informó un tamaño válido para el documento");
            }
            return new StorageDownloadResult(
                    response,
                    StorageUploadValidator.normalizeContentType(contentType),
                    contentLength);
        } catch (StorageException exception) {
            throw exception;
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                throw new StorageException(
                        StorageException.Reason.NOT_FOUND,
                        "El archivo documental solicitado no está disponible",
                        exception);
            }
            throw storageFailure("No fue posible abrir el documento almacenado", exception);
        } catch (RuntimeException exception) {
            throw storageFailure("No fue posible abrir el documento almacenado", exception);
        }
    }

    @Override
    public boolean exists(String storageKey) {
        String safeStorageKey = StorageObjectKey.requireSafe(storageKey);
        try {
            s3Client.headObject(HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(safeStorageKey)
                    .build());
            return true;
        } catch (S3Exception exception) {
            if (exception.statusCode() == 404) {
                return false;
            }
            throw storageFailure("No fue posible verificar el documento almacenado", exception);
        } catch (RuntimeException exception) {
            throw storageFailure("No fue posible verificar el documento almacenado", exception);
        }
    }

    @Override
    public void delete(String storageKey) {
        String safeStorageKey = StorageObjectKey.requireSafe(storageKey);
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(safeStorageKey)
                    .build());
        } catch (RuntimeException exception) {
            throw storageFailure("No fue posible eliminar el documento almacenado", exception);
        }
    }

    @PreDestroy
    void close() {
        s3Client.close();
    }

    private static S3Client buildClient(StorageProperties properties) {
        StorageProperties.S3 settings = properties.getS3();
        validateSettings(settings);
        URI endpoint = parseEndpoint(settings.getEndpoint());

        return S3Client.builder()
                .endpointOverride(endpoint)
                .region(Region.of(settings.getRegion().strip()))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(
                        settings.getAccessKey().strip(),
                        settings.getSecretKey())))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(settings.isForcePathStyle())
                        .build())
                .build();
    }

    private static void validateSettings(StorageProperties.S3 settings) {
        requireSetting(settings.getEndpoint(), "APP_STORAGE_S3_ENDPOINT");
        requireSetting(settings.getRegion(), "APP_STORAGE_S3_REGION");
        requireSetting(settings.getBucket(), "APP_STORAGE_S3_BUCKET");
        requireSetting(settings.getAccessKey(), "APP_STORAGE_S3_ACCESS_KEY");
        requireSetting(settings.getSecretKey(), "APP_STORAGE_S3_SECRET_KEY");

        String bucket = settings.getBucket().strip();
        if (bucket.length() > 120
                || bucket.contains("/")
                || bucket.contains("\\")
                || bucket.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalStateException("APP_STORAGE_S3_BUCKET no tiene un formato válido");
        }
        parseEndpoint(settings.getEndpoint());
    }

    private static URI parseEndpoint(String value) {
        try {
            URI endpoint = new URI(value.strip());
            if (endpoint.getHost() == null
                    || (!"http".equalsIgnoreCase(endpoint.getScheme())
                    && !"https".equalsIgnoreCase(endpoint.getScheme()))
                    || endpoint.getUserInfo() != null
                    || endpoint.getQuery() != null
                    || endpoint.getFragment() != null) {
                throw new IllegalStateException(
                        "APP_STORAGE_S3_ENDPOINT debe ser una URL HTTP(S) válida sin credenciales ni query");
            }
            return endpoint;
        } catch (URISyntaxException exception) {
            throw new IllegalStateException(
                    "APP_STORAGE_S3_ENDPOINT debe ser una URL HTTP(S) válida",
                    exception);
        }
    }

    private static void requireSetting(String value, String variableName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    variableName + " es obligatoria cuando APP_STORAGE_PROVIDER=s3");
        }
    }

    private static StorageException storageFailure(String message, RuntimeException exception) {
        return new StorageException(StorageException.Reason.IO_ERROR, message, exception);
    }
}
