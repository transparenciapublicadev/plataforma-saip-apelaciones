package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Comunicación ciudadana de omisión de elevación por parte de la entidad")
public record ComunicarOmisionElevacionRequest(
        @NotBlank @Size(max = 500) String referenciaPruebaOmision,
        @Size(max = 5000) String observacion
) {
}
