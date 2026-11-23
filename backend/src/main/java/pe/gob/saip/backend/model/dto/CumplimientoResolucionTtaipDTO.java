package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip;

@Schema(description = "Seguimiento de cumplimiento de una resolución final fundada o fundada en parte")
public record CumplimientoResolucionTtaipDTO(
        Long id,
        Long expedienteTtaipId,
        String numeroExpediente,
        Long apelacionId,
        Long resolucionId,
        String numeroResolucion,
        String decisionResolucion,
        Long entidadId,
        String entidadNombre,
        String fechaRequerimientoCumplimiento,
        String fechaLimiteCumplimiento,
        String fechaCumplimiento,
        @Schema(description = "Estado del cumplimiento", example = "PENDIENTE", implementation = CumplimientoResolucionTtaip.EstadoCumplimiento.class, allowableValues = {"PENDIENTE", "CUMPLIDO", "CUMPLIDO_PARCIAL", "VENCIDO", "OBSERVADO", "CERRADO"})
        String estadoCumplimiento,
        @Schema(description = "Tipo de cumplimiento", example = "TOTAL", implementation = CumplimientoResolucionTtaip.TipoCumplimiento.class, allowableValues = {"TOTAL", "PARCIAL", "NO_CUMPLE"})
        String tipoCumplimiento,
        String descripcionCumplimiento,
        String evidenciaCumplimiento,
        String referenciaDocumento,
        String responsableEntidad,
        String observacion,
        String trazabilidad,
        boolean documental
) {
    public static CumplimientoResolucionTtaipDTO from(CumplimientoResolucionTtaip cumplimiento) {
        return new CumplimientoResolucionTtaipDTO(
                cumplimiento.getId(),
                cumplimiento.getExpediente() != null ? cumplimiento.getExpediente().getId() : null,
                cumplimiento.getExpediente() != null ? cumplimiento.getExpediente().getNumeroExpediente() : null,
                cumplimiento.getApelacion() != null ? cumplimiento.getApelacion().getId() : null,
                cumplimiento.getResolucion() != null ? cumplimiento.getResolucion().getId() : null,
                cumplimiento.getResolucion() != null ? cumplimiento.getResolucion().getNumeroResolucion() : null,
                cumplimiento.getResolucion() != null && cumplimiento.getResolucion().getDecision() != null
                        ? cumplimiento.getResolucion().getDecision().name()
                        : null,
                cumplimiento.getEntidad() != null ? cumplimiento.getEntidad().getId() : null,
                cumplimiento.getEntidad() != null ? cumplimiento.getEntidad().getNombre() : null,
                cumplimiento.getFechaRequerimientoCumplimiento() != null
                        ? cumplimiento.getFechaRequerimientoCumplimiento().toString()
                        : null,
                cumplimiento.getFechaLimiteCumplimiento() != null
                        ? cumplimiento.getFechaLimiteCumplimiento().toString()
                        : null,
                cumplimiento.getFechaCumplimiento() != null ? cumplimiento.getFechaCumplimiento().toString() : null,
                cumplimiento.getEstadoCumplimiento() != null ? cumplimiento.getEstadoCumplimiento().name() : null,
                cumplimiento.getTipoCumplimiento() != null ? cumplimiento.getTipoCumplimiento().name() : null,
                cumplimiento.getDescripcionCumplimiento(),
                cumplimiento.getEvidenciaCumplimiento(),
                cumplimiento.getReferenciaDocumento(),
                cumplimiento.getResponsableEntidad(),
                cumplimiento.getObservacion(),
                cumplimiento.getTrazabilidad(),
                cumplimiento.getIdNotificacionInicio() != null
        );
    }
}
