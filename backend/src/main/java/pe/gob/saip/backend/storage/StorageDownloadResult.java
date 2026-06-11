package pe.gob.saip.backend.storage;

import java.io.InputStream;

public record StorageDownloadResult(
        InputStream content,
        String contentType,
        long sizeBytes) {
}
