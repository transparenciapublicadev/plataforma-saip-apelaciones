package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Actualización operativa de pago o recojo de una liquidación SAIP")
public record ActualizarLiquidacionCostoRequest(
        @NotBlank(message = "El estado de liquidación es obligatorio")
        @Schema(description = "Estado destino", allowableValues = {"PAGADA", "RECOGIDA", "CANCELADA"})
        String estado,

        @Schema(description = "Fecha de pago. Si se omite al marcar PAGADA, se usa la fecha actual.")
        LocalDate fechaPago,

        @Schema(description = "Fecha de recojo. Si se omite al marcar RECOGIDA, se usa la fecha actual.")
        LocalDate fechaRecojo,

        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        String responsable,

        @Size(max = 3000, message = "La observación no puede exceder 3000 caracteres")
        String observacion
) {
}
