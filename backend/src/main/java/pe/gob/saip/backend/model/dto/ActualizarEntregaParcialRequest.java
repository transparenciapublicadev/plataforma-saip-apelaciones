package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Actualización del estado de una entrega parcial SAIP")
public record ActualizarEntregaParcialRequest(
        @NotBlank(message = "El estado de la entrega parcial es obligatorio")
        @Schema(description = "Estado de la entrega parcial", example = "ENTREGADA", allowableValues = {"PROGRAMADA", "ENTREGADA", "OBSERVADA", "CANCELADA", "VENCIDA"})
        String estado,

        @Schema(description = "Fecha real de entrega, obligatoria cuando el estado es ENTREGADA", example = "2026-06-10")
        LocalDate fechaEntregaReal,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación del avance o incidencia de la entrega parcial", example = "Entrega digital enviada por casilla electrónica.")
        String observacion
) {
}
