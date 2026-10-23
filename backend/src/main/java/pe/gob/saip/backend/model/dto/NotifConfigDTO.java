package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Reglas y alertas de notificación del sistema")
public record NotifConfigDTO(
        @NotNull Boolean vencidas,
        @NotNull Boolean proximos,
        @NotNull Boolean registros,
        @NotNull @Min(1) Integer umbralProximo
) {}
