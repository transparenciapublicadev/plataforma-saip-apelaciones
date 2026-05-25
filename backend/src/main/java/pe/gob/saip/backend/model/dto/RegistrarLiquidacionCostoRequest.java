package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Datos para emitir y notificar una liquidación o cupón de pago SAIP")
public record RegistrarLiquidacionCostoRequest(
        @Schema(description = "Código externo o número de cupón. Si se omite, el sistema lo genera.")
        @Size(max = 60, message = "El código de liquidación no puede exceder 60 caracteres")
        String codigoLiquidacion,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.00", message = "El monto no puede ser negativo")
        @Schema(description = "Monto de reproducción física", example = "18.50")
        BigDecimal monto,

        @Pattern(regexp = "^[A-Z]{3}$", message = "La moneda debe usar código ISO de 3 letras")
        @Schema(description = "Moneda ISO 4217", example = "PEN")
        String moneda,

        @NotBlank(message = "El concepto es obligatorio")
        @Size(max = 3000, message = "El concepto no puede exceder 3000 caracteres")
        @Schema(description = "Detalle del costo de reproducción", example = "Copias simples de 37 folios")
        String concepto,

        @NotNull(message = "La fecha de notificación es obligatoria")
        @Schema(description = "Fecha en la que se notifica el cupón al ciudadano")
        LocalDate fechaNotificacion,

        @NotBlank(message = "El medio de notificación es obligatorio")
        @Schema(description = "Medio usado para notificar el cupón", allowableValues = {"CORREO_ELECTRONICO", "CASILLA_ELECTRONICA", "PLATAFORMA", "FISICA"})
        String medioNotificacion,

        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        String responsable,

        @Size(max = 3000, message = "La observación no puede exceder 3000 caracteres")
        String observacion
) {
}
