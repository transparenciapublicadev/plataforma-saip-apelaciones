package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Schema(description = "Validación manual de una notificación TTAIP cuando el flujo depende de notificación válida")
public record ValidarNotificacionManualRequest(
        @Schema(description = "Fecha y hora de validación manual. Si se omite, se usa la fecha actual.", example = "2026-05-25T11:00:00")
        LocalDateTime fechaValidacionManual,

        @NotBlank(message = "El responsable de validación es obligatorio")
        @Schema(description = "Responsable que valida la notificación", example = "Secretaría Técnica TTAIP")
        String responsableValidacion,

        @NotBlank(message = "La observación de validación es obligatoria")
        @Schema(description = "Sustento funcional de la validación manual")
        String observacionValidacion,

        @Size(max = 500, message = "La URL de evidencia no puede exceder 500 caracteres")
        @Schema(description = "URL interna o referencia descargable de evidencia")
        String evidenciaUrl,

        @Size(max = 500, message = "La referencia de evidencia no puede exceder 500 caracteres")
        @Schema(description = "Referencia documental alternativa de evidencia")
        String referenciaEvidencia
) {
}
