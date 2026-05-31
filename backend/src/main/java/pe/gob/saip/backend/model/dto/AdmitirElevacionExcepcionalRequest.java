package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Admisión excepcional TTAIP de una apelación cuya elevación fue omitida por la entidad")
public record AdmitirElevacionExcepcionalRequest(
        @NotBlank @Size(max = 120) String responsableTtaip,
        @NotBlank @Size(max = 5000) String observacion
) {
}
