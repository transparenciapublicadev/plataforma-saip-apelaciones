package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Observación TTAIP al cumplimiento comunicado por la entidad pública")
public record ObservarCumplimientoResolucionRequest(
        @NotBlank(message = "La observación es obligatoria")
        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Motivo por el que el TTAIP observa el cumplimiento", example = "La evidencia remitida no acredita entrega completa de la información.")
        String observacion,

        @Size(max = 120, message = "El responsable TTAIP no puede exceder 120 caracteres")
        @Schema(description = "Responsable TTAIP que observa el cumplimiento", example = "Secretaría Técnica TTAIP")
        String responsableTtaip
) {
}
