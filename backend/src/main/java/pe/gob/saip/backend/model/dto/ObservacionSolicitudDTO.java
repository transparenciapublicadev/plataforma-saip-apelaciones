package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;

@Schema(description = "Observación y subsanación formal de una solicitud SAIP")
public record ObservacionSolicitudDTO(
        Long id,
        Long solicitudId,
        String expediente,
        String motivoObservacion,
        String fechaObservacion,
        String fechaLimiteSubsanacion,
        String fechaSubsanacion,
        String comentarioSubsanacion,
        String documentoSubsanacionNombre,
        String documentoSubsanacionRuta,
        String estado,
        String trazabilidad,
        String responsableObservacion,
        String responsableSubsanacion
) {
    public static ObservacionSolicitudDTO from(ObservacionSolicitud observacion) {
        return new ObservacionSolicitudDTO(
                observacion.getId(),
                observacion.getSolicitud() != null ? observacion.getSolicitud().getId() : null,
                observacion.getSolicitud() != null ? observacion.getSolicitud().getExpediente() : null,
                observacion.getMotivoObservacion(),
                observacion.getFechaObservacion() != null ? observacion.getFechaObservacion().toString() : null,
                observacion.getFechaLimiteSubsanacion() != null ? observacion.getFechaLimiteSubsanacion().toString() : null,
                observacion.getFechaSubsanacion() != null ? observacion.getFechaSubsanacion().toString() : null,
                observacion.getComentarioSubsanacion(),
                observacion.getDocumentoSubsanacionNombre(),
                observacion.getDocumentoSubsanacionRuta(),
                observacion.getEstado() != null ? observacion.getEstado().name() : null,
                observacion.getTrazabilidad(),
                observacion.getResponsableObservacion(),
                observacion.getResponsableSubsanacion()
        );
    }
}
