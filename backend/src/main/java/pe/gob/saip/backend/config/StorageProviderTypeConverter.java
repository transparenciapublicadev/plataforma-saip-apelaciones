package pe.gob.saip.backend.config;

import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationPropertiesBinding;
import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

import pe.gob.saip.backend.storage.StorageProviderType;

@Component
@ConfigurationPropertiesBinding
public class StorageProviderTypeConverter implements Converter<String, StorageProviderType> {

    @Override
    public StorageProviderType convert(String source) {
        if (source == null || source.isBlank()) {
            return StorageProviderType.LOCAL;
        }

        return switch (source.strip().toLowerCase(Locale.ROOT)) {
            case "local" -> StorageProviderType.LOCAL;
            case "s3", "s3-compatible", "s3_compatible" -> StorageProviderType.S3_COMPATIBLE;
            default -> throw new IllegalArgumentException(
                    "APP_STORAGE_PROVIDER debe ser local o s3");
        };
    }
}
