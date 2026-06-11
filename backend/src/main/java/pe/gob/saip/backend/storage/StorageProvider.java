package pe.gob.saip.backend.storage;

public interface StorageProvider {

    StorageProviderType type();

    StorageUploadResult upload(StorageUploadRequest request);

    StorageDownloadResult download(String storageKey, String contentType);

    boolean exists(String storageKey);

    void delete(String storageKey);
}
