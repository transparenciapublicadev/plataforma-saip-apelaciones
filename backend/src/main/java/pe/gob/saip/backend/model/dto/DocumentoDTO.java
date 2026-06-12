package pe.gob.saip.backend.model.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Documento;

import java.util.List;

@Schema(description = "Documento adjunto a solicitud, respuesta, apelación o resolución")
public record DocumentoDTO(
    Long id,
    String nombreArchivo,
    @JsonIgnore
    @Schema(hidden = true)
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

    public static List<DocumentoDTO> fromActive(List<Documento> documentos) {
        if (documentos == null) {
            return List.of();
        }
        return documentos.stream()
                .filter(documento -> documento.getEstado() == Documento.EstadoDocumento.ACTIVO)
                .map(DocumentoDTO::from)
                .toList();
    }
}
