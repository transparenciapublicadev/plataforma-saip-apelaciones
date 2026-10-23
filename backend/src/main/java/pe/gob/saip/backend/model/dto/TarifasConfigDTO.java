package pe.gob.saip.backend.model.dto;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Tarifas y costos de reproducción")
public record TarifasConfigDTO(
        @NotNull @DecimalMin("0.0") BigDecimal costoPorCopia
) {}
