package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

@Schema(description = "Plazos normativos del sistema en días hábiles")
public record PlazosConfigDTO(
        @NotNull @Min(1) Integer saipRespuesta,
        @NotNull @Min(1) Integer saipProrroga,
        @NotNull @Min(1) Integer subsanacion,
        @NotNull @Min(1) Integer recojoInformacion,
        @NotNull @Min(1) Integer apelacionInterposicion,
        @NotNull @Min(1) Integer ttaipResolucion,
        @NotNull @Min(1) Integer ttaipCalificacion,
        @NotNull @Min(1) Integer ttaipSubsanacion
) {}
