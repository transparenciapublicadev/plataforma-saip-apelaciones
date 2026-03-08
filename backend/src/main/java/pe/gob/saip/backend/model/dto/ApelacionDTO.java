package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

import java.util.List;

@Schema(description = "Apelación ante el Tribunal de Transparencia (TTAIP)")
public record ApelacionDTO(
    Long id,
    @Schema(description = "Número de expediente TTAIP", example = "01560-2025-JUS/TTAIP")
    String expediente,
    String fundamentos,
    @Schema(description = "Estado de la apelación", example = "PENDIENTE_ELEVACION")
    String estado,
    String resultado,
    String fechaApelacion,
    String fechaSubsanacion,
    Integer diasSubsanacion,
    String calificacionPrimera,
    String calificacionSegunda,
    Long solicitudId,
    String solicitudExpediente,
    String solicitudAsunto,
    Long ciudadanoId,
    String ciudadanoNombre,
    Long entidadId,
    String entidadNombre,
    @Schema(description = "Resolución final (RESOLUCION_FINAL)")
    ResolucionDTO resolucion,
    @Schema(description = "Resolución de primera calificación (PRIMERA_CALIFICACION)")
    ResolucionDTO resolucionPrimeraCalificacion,
    @Schema(description = "Resolución de segunda calificación (SEGUNDA_CALIFICACION)")
    ResolucionDTO resolucionSegundaCalificacion,
    List<DocumentoDTO> documentos
) {
    public static ApelacionDTO from(Apelacion a) {
        return new ApelacionDTO(
            a.getId(),
            a.getExpediente(),
            a.getFundamentos(),
            a.getEstado() != null ? a.getEstado().name() : null,
            a.getResultado(),
            a.getFechaApelacion() != null ? a.getFechaApelacion().toString() : null,
            a.getFechaSubsanacion() != null ? a.getFechaSubsanacion().toString() : null,
            a.getDiasSubsanacion(),
            a.getCalificacionPrimera() != null ? a.getCalificacionPrimera().name() : null,
            a.getCalificacionSegunda() != null ? a.getCalificacionSegunda().name() : null,
            a.getSolicitud() != null ? a.getSolicitud().getId() : null,
            a.getSolicitud() != null ? a.getSolicitud().getExpediente() : null,
            a.getSolicitud() != null ? a.getSolicitud().getAsunto() : null,
            a.getCiudadano() != null ? a.getCiudadano().getId() : null,
            a.getCiudadano() != null ? a.getCiudadano().getNombreCompleto() : null,
            a.getSolicitud() != null && a.getSolicitud().getEntidad() != null ? a.getSolicitud().getEntidad().getId() : null,
            a.getSolicitud() != null && a.getSolicitud().getEntidad() != null ? a.getSolicitud().getEntidad().getNombre() : null,
            a.getResolucion() != null ? ResolucionDTO.from(a.getResolucion()) : null,
            a.getResolucionPrimeraCalificacion() != null ? ResolucionDTO.from(a.getResolucionPrimeraCalificacion()) : null,
            a.getResolucionSegundaCalificacion() != null ? ResolucionDTO.from(a.getResolucionSegundaCalificacion()) : null,
            a.getDocumentos() != null ? a.getDocumentos().stream().map(DocumentoDTO::from).toList() : List.of()
        );
    }
}
