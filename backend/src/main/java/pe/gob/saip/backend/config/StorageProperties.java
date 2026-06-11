package pe.gob.saip.backend.config;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.Setter;
import pe.gob.saip.backend.storage.StorageProviderType;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.storage")
public class StorageProperties {

    private StorageProviderType provider = StorageProviderType.LOCAL;
    private long maxFileSize = 10_485_760L;
    private Set<String> allowedContentTypes = new LinkedHashSet<>(Set.of(
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain"));
    private final Local local = new Local();
    private final S3 s3 = new S3();

    @Getter
    @Setter
    public static class Local {
        private String basePath;
    }

    @Getter
    @Setter
    public static class S3 {
        private String endpoint;
        private String region = "us-east-1";
        private String bucket;
        private String accessKey;
        private String secretKey;
        private boolean forcePathStyle = true;
    }
}
