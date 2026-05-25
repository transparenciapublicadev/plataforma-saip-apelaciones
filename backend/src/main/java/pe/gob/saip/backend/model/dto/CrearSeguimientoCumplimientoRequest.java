package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Solicitud para crear seguimiento de cumplimiento de resolución fundada")
public record CrearSeguimientoCumplimientoRequest(
        @Schema(description = "Fecha base del requerimiento. Si no se envía, se usa notificación válida o fecha de resolución.", example = "2026-05-29")
        LocalDate fechaRequerimientoCumplimiento,

        @Size(max = 120, message = "El responsable TTAIP no puede exceder 120 caracteres")
        @Schema(description = "Responsable TTAIP que registra el seguimiento", example = "Secretaría Técnica TTAIP")
        String responsableTtaip,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación o sustento del requerimiento", example = "Seguimiento de cumplimiento de resolución fundada.")
        String observacion
) {
}
