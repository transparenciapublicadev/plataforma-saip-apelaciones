package pe.gob.saip.backend.storage;

public record StorageObjectMetadata(
        StorageProviderType provider,
        String bucket,
        String storageKey,
        String originalFilename,
        String contentType,
        long sizeBytes,
        String hashSha256) {
}
