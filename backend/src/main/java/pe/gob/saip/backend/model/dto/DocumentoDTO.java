package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Documento;

@Schema(description = "Documento adjunto a solicitud, respuesta, apelación o resolución")
public record DocumentoDTO(
    Long id,
    String nombreArchivo,
    String rutaArchivo,
    String tipoArchivo,
    Long tamanio,
    String tipoDocumento,
    String fechaSubida
) {
    public static DocumentoDTO from(Documento d) {
        return new DocumentoDTO(
            d.getId(),
            d.getNombreOriginal(),
            null,
            d.getContentType(),
            d.getSizeBytes(),
            d.getTipoDocumento() != null ? d.getTipoDocumento().name() : null,
            d.getFechaCreacion() != null ? d.getFechaCreacion().toString() : null
        );
    }
}
