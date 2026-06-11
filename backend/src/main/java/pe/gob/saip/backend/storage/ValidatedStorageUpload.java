package pe.gob.saip.backend.storage;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

record ValidatedStorageUpload(
        Path temporaryFile,
        String originalFilename,
        String contentType,
        String extension,
        long sizeBytes,
        String hashSha256) implements AutoCloseable {

    @Override
    public void close() {
        try {
            Files.deleteIfExists(temporaryFile);
        } catch (IOException ignored) {
            // The storage operation result remains the actionable outcome.
        }
    }
}
