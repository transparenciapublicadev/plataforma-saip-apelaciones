package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

@Schema(description = "Subsanación ciudadana de una observación SAIP")
public record SubsanarSolicitudRequest(
        @Size(max = 3000, message = "El comentario de subsanación no puede exceder 3000 caracteres")
        @Schema(description = "Comentario o fundamento de subsanación", example = "Preciso que solicito el presupuesto ejecutado del programa X durante 2025.")
        String comentarioSubsanacion,

        @Size(max = 255, message = "El nombre del documento no puede exceder 255 caracteres")
        @Schema(description = "Nombre del documento de subsanación, si aplica", example = "subsanacion-saip.pdf")
        String documentoSubsanacionNombre,

        @Size(max = 500, message = "La ruta del documento no puede exceder 500 caracteres")
        @Schema(description = "Ruta o referencia del documento de subsanación, si aplica", example = "/uploads/saip/subsanacion-saip.pdf")
        String documentoSubsanacionRuta,

        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        @Schema(description = "Responsable que registra la subsanación", example = "Ciudadano")
        String responsable
) {
}
