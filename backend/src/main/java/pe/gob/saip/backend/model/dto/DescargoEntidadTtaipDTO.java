package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.DescargoEntidadTtaip;

@Schema(description = "Descargo presentado o requerido a la entidad pública dentro de un expediente TTAIP")
public record DescargoEntidadTtaipDTO(
        Long id,
        Long expedienteTtaipId,
        String numeroExpediente,
        Long apelacionId,
        Long entidadId,
        String entidadNombre,
        String fechaRequerimiento,
        String fechaLimiteDescargo,
        String fechaPresentacion,
        String estadoDescargo,
        String resumenDescargo,
        String documentoDescargo,
        String responsableEntidad,
        String observacion,
        String trazabilidad
) {
    public static DescargoEntidadTtaipDTO from(DescargoEntidadTtaip descargo) {
        return new DescargoEntidadTtaipDTO(
                descargo.getId(),
                descargo.getExpediente() != null ? descargo.getExpediente().getId() : null,
                descargo.getExpediente() != null ? descargo.getExpediente().getNumeroExpediente() : null,
                descargo.getApelacion() != null ? descargo.getApelacion().getId() : null,
                descargo.getEntidad() != null ? descargo.getEntidad().getId() : null,
                descargo.getEntidad() != null ? descargo.getEntidad().getNombre() : null,
                descargo.getFechaRequerimiento() != null ? descargo.getFechaRequerimiento().toString() : null,
                descargo.getFechaLimiteDescargo() != null ? descargo.getFechaLimiteDescargo().toString() : null,
                descargo.getFechaPresentacion() != null ? descargo.getFechaPresentacion().toString() : null,
                descargo.getEstadoDescargo() != null ? descargo.getEstadoDescargo().name() : null,
                descargo.getResumenDescargo(),
                descargo.getDocumentoDescargo(),
                descargo.getResponsableEntidad(),
                descargo.getObservacion(),
                descargo.getTrazabilidad()
        );
    }
}
