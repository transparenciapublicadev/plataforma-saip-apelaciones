package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Documento;

@Schema(description = "Metadatos seguros de un documento almacenado; no expone claves ni rutas internas")
public record DocumentoMetadataDTO(
        Long id,
        String tipoDocumento,
        String nombreOriginal,
        String contentType,
        Long sizeBytes,
        String hashSha256,
        String estado,
        LocalDateTime fechaCreacion,
        Long solicitudId,
        Long respuestaId,
        Long apelacionId,
        Long expedienteTtaipId,
        Long resolucionId,
        Long cedulaNotificacionId,
        String expedienteOrigen,
        String entidadOrigen) {

    public static DocumentoMetadataDTO from(Documento documento) {
        return new DocumentoMetadataDTO(
                documento.getIdDocumento(),
                enumName(documento.getTipoDocumento()),
                documento.getNombreOriginal(),
                documento.getContentType(),
                documento.getSizeBytes(),
                documento.getHashSha256(),
                enumName(documento.getEstado()),
                documento.getFechaCreacion(),
                documento.getSolicitud() != null ? documento.getSolicitud().getIdSolicitud() : null,
                documento.getRespuesta() != null ? documento.getRespuesta().getIdRespuesta() : null,
                documento.getApelacion() != null ? documento.getApelacion().getIdApelacion() : null,
                documento.getExpedienteTtaip() != null
                        ? documento.getExpedienteTtaip().getIdExpedienteTtaip()
                        : null,
                documento.getResolucion() != null ? documento.getResolucion().getIdResolucion() : null,
                documento.getCedulaNotificacion() != null
                        ? documento.getCedulaNotificacion().getIdCedula()
                        : null,
                blankToNull(documento.getExpedienteOrigen()),
                blankToNull(documento.getEntidadOrigen()));
    }

    public static List<DocumentoMetadataDTO> fromActive(List<Documento> documentos) {
        if (documentos == null) {
            return List.of();
        }
        return documentos.stream()
                .filter(documento -> documento.getEstado() == Documento.EstadoDocumento.ACTIVO)
                .sorted(Comparator.comparing(
                        Documento::getFechaCreacion,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(DocumentoMetadataDTO::from)
                .toList();
    }

    private static String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
