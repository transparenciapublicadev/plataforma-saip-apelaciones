package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;

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
        String storageProvider,
        String estado,
        Long creadoPorId,
        LocalDateTime fechaCreacion,
        LocalDateTime fechaActualizacion,
        Long solicitudId,
        Long respuestaId,
        Long apelacionId,
        Long expedienteTtaipId,
        Long resolucionId,
        Long cedulaNotificacionId) {

    public static DocumentoMetadataDTO from(Documento documento) {
        return new DocumentoMetadataDTO(
                documento.getIdDocumento(),
                enumName(documento.getTipoDocumento()),
                documento.getNombreOriginal(),
                documento.getContentType(),
                documento.getSizeBytes(),
                documento.getHashSha256(),
                enumName(documento.getStorageProvider()),
                enumName(documento.getEstado()),
                documento.getCreadoPor() != null ? documento.getCreadoPor().getIdUsuario() : null,
                documento.getFechaCreacion(),
                documento.getFechaActualizacion(),
                documento.getSolicitud() != null ? documento.getSolicitud().getIdSolicitud() : null,
                documento.getRespuesta() != null ? documento.getRespuesta().getIdRespuesta() : null,
                documento.getApelacion() != null ? documento.getApelacion().getIdApelacion() : null,
                documento.getExpedienteTtaip() != null
                        ? documento.getExpedienteTtaip().getIdExpedienteTtaip()
                        : null,
                documento.getResolucion() != null ? documento.getResolucion().getIdResolucion() : null,
                documento.getCedulaNotificacion() != null
                        ? documento.getCedulaNotificacion().getIdCedula()
                        : null);
    }

    private static String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }
}
