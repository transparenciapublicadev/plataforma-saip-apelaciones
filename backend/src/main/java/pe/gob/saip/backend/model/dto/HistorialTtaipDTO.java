package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.HistorialTtaip;

@Schema(description = "Evento de trazabilidad del expediente TTAIP")
public record HistorialTtaipDTO(
        Long id,
        String tipoEvento,
        String descripcion,
        String estadoAnterior,
        String estadoNuevo,
        String actor,
        String referencia,
        String fechaEvento
) {
    public static HistorialTtaipDTO from(HistorialTtaip historial) {
        return new HistorialTtaipDTO(
                historial.getId(),
                historial.getTipoEvento() != null ? historial.getTipoEvento().name() : null,
                historial.getDescripcion(),
                historial.getEstadoAnterior(),
                historial.getEstadoNuevo(),
                historial.getActor(),
                historial.getReferencia(),
                historial.getFechaEvento() != null ? historial.getFechaEvento().toString() : null
        );
    }
}
