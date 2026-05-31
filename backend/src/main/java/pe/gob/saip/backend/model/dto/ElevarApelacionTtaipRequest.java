package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Elevación de la apelación desde la entidad pública al TTAIP")
public record ElevarApelacionTtaipRequest(
        @NotBlank @Size(max = 120) String responsableEntidad,
        @NotBlank @Size(max = 500) String referenciaExpedienteElevado,
        @Size(max = 5000) String observacion
) {
}
