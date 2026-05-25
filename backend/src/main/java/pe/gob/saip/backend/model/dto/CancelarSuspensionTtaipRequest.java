package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Cancelación operativa de una suspensión adicional de plazo TTAIP")
public record CancelarSuspensionTtaipRequest(
        @Schema(description = "Fecha de cancelación. Si se omite, se usa la fecha actual.", example = "2026-05-13")
        LocalDate fechaCancelacion,

        @NotBlank(message = "El responsable es obligatorio")
        @Size(max = 180, message = "El responsable no puede exceder 180 caracteres")
        @Schema(description = "Responsable que cancela la suspensión", example = "Secretaría Técnica TTAIP")
        String responsable,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Motivo de cancelación", example = "La parte desistió de la solicitud de informe oral.")
        String observacion
) {
}
