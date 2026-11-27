package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

@Schema(description = "Evento unificado de actividad reciente del sistema")
public record ActividadRecienteDTO(
        String dot,
        String label,
        String detail,
        LocalDateTime fecha,
        Long ts
) {
}
