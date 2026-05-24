package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Entrega parcial del cronograma de ampliación SAIP")
public record RegistrarEntregaParcialRequest(
        @NotNull(message = "El número de entrega es obligatorio")
        @Positive(message = "El número de entrega debe ser mayor que cero")
        @Schema(description = "Número secuencial de entrega", example = "1")
        Integer numeroEntrega,

        @NotBlank(message = "La descripción de la entrega es obligatoria")
        @Size(max = 1000, message = "La descripción no puede exceder 1000 caracteres")
        @Schema(description = "Descripción de la información que se entregará parcialmente", example = "Primer bloque de contratos digitalizados")
        String descripcion,

        @NotNull(message = "La fecha programada es obligatoria")
        @Schema(description = "Fecha programada de entrega parcial", example = "2026-06-10")
        LocalDate fechaProgramada,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación opcional de la entrega parcial", example = "Entrega sujeta a digitalización de archivos históricos")
        String observacion
) {
}
