package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.ReprocesoNotificacion;

@Schema(description = "Reproceso de notificación vinculado a una cédula del expediente TTAIP")
public record ReprocesoNotificacionDTO(
        Long id,
        Long notificacionId,
        Long cedulaOriginalId,
        Long reprocesoPadreId,
        String destinatario,
        String numeroCedulaOriginal,
        String fechaIngresoCargo,
        String observacionReproceso,
        String fechaSubsanacion,
        String cedulaSubsanacion,
        String fechaCedulaSubsanacion,
        Integer numeroIntento,
        String estado,
        String responsableNotificacion,
        String responsableSubsanacion,
        String fechaCreacion,
        String fechaActualizacion
) {
    public static ReprocesoNotificacionDTO from(ReprocesoNotificacion reproceso) {
        return new ReprocesoNotificacionDTO(
                reproceso.getId(),
                reproceso.getNotificacion() != null ? reproceso.getNotificacion().getId() : null,
                reproceso.getCedulaOriginal() != null ? reproceso.getCedulaOriginal().getId() : null,
                reproceso.getReprocesoPadre() != null ? reproceso.getReprocesoPadre().getId() : null,
                reproceso.getDestinatario() != null ? reproceso.getDestinatario().name() : null,
                reproceso.getNumeroCedulaOriginal(),
                reproceso.getFechaIngresoCargo() != null ? reproceso.getFechaIngresoCargo().toString() : null,
                reproceso.getObservacionReproceso(),
                reproceso.getFechaSubsanacion() != null ? reproceso.getFechaSubsanacion().toString() : null,
                reproceso.getCedulaSubsanacion(),
                reproceso.getFechaCedulaSubsanacion() != null ? reproceso.getFechaCedulaSubsanacion().toString() : null,
                reproceso.getNumeroIntento(),
                reproceso.getEstado() != null ? reproceso.getEstado().name() : null,
                reproceso.getResponsableNotificacion(),
                reproceso.getResponsableSubsanacion(),
                reproceso.getFechaCreacion() != null ? reproceso.getFechaCreacion().toString() : null,
                reproceso.getFechaActualizacion() != null ? reproceso.getFechaActualizacion().toString() : null
        );
    }
}
