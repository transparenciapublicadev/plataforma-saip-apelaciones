package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Resolucion;

@Schema(description = "Resolución del TTAIP sobre una apelación")
public record ResolucionDTO(
    Long id,
    String tipoResolucion,
    String decision,
    String fundamentos,
    String observaciones,
    String fechaResolucion,
    Long miembroTTAIPId,
    String miembroTTAIPNombre
) {
    public static ResolucionDTO from(Resolucion r) {
        return new ResolucionDTO(
            r.getId(),
            r.getTipoResolucion() != null ? r.getTipoResolucion().name() : null,
            r.getDecision() != null ? r.getDecision().name() : null,
            r.getFundamentos(),
            r.getObservaciones(),
            r.getFechaResolucion() != null ? r.getFechaResolucion().toString() : null,
            r.getMiembroTTAIP() != null ? r.getMiembroTTAIP().getId() : null,
            r.getMiembroTTAIP() != null ? r.getMiembroTTAIP().getNombreCompleto() : null
        );
    }
}
