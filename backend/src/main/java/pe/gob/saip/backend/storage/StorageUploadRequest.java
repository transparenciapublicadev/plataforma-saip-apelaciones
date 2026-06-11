package pe.gob.saip.backend.storage;

import java.io.InputStream;

public record StorageUploadRequest(
        String originalFilename,
        String contentType,
        long declaredSize,
        InputStream content) {
}
