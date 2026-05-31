package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Registro de una apelación SAIP interna presentada ante la entidad para su elevación al TTAIP")
public record CrearApelacionAnteEntidadRequest(
        @NotNull Long solicitudId,
        @NotNull Long ciudadanoId,
        @NotBlank @Size(max = 5000) String fundamentos,
        @NotNull LocalDate fechaPresentacionAnteEntidad,
        @NotBlank @Size(max = 500) String referenciaCargoPresentacion,
        @Size(max = 5000) String observacion
) {
}
