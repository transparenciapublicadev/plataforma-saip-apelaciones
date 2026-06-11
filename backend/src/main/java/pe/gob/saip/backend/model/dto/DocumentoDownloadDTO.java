package pe.gob.saip.backend.model.dto;

import java.io.InputStream;

public record DocumentoDownloadDTO(
        String nombreOriginal,
        String contentType,
        long sizeBytes,
        InputStream content) {
}
