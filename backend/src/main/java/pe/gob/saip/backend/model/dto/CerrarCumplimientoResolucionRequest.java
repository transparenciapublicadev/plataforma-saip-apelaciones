package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Cierre operativo de seguimiento de cumplimiento de resolución fundada")
public record CerrarCumplimientoResolucionRequest(
        @Size(max = 120, message = "El responsable TTAIP no puede exceder 120 caracteres")
        @Schema(description = "Responsable TTAIP que cierra el seguimiento", example = "Secretaría Técnica TTAIP")
        String responsableTtaip,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación de cierre", example = "Se verifica cumplimiento total y se cierra el seguimiento.")
        String observacion
) {
}
