package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.SuspensionPlazoTtaip;

@Schema(description = "Suspensión de plazo de resolución final dentro de un expediente TTAIP")
public record SuspensionPlazoTtaipDTO(
        Long id,
        Long expedienteTtaipId,
        String numeroExpediente,
        Long descargoId,
        String motivoSuspension,
        String fechaInicioSuspension,
        String fechaFinSuspension,
        Integer diasSuspendidos,
        String estadoSuspension,
        String trazabilidad
) {
    public static SuspensionPlazoTtaipDTO from(SuspensionPlazoTtaip suspension) {
        return new SuspensionPlazoTtaipDTO(
                suspension.getId(),
                suspension.getExpediente() != null ? suspension.getExpediente().getId() : null,
                suspension.getExpediente() != null ? suspension.getExpediente().getNumeroExpediente() : null,
                suspension.getDescargo() != null ? suspension.getDescargo().getId() : null,
                suspension.getMotivoSuspension() != null ? suspension.getMotivoSuspension().name() : null,
                suspension.getFechaInicioSuspension() != null ? suspension.getFechaInicioSuspension().toString() : null,
                suspension.getFechaFinSuspension() != null ? suspension.getFechaFinSuspension().toString() : null,
                suspension.getDiasSuspendidos(),
                suspension.getEstadoSuspension() != null ? suspension.getEstadoSuspension().name() : null,
                suspension.getTrazabilidad()
        );
    }
}
