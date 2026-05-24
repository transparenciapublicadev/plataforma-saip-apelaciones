package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Solicitud de reproceso para una notificación TTAIP fallida o defectuosa")
public record ReprocesarNotificacionRequest(
        @NotBlank(message = "El número de cédula original es obligatorio")
        @Schema(description = "Número de la cédula original que tuvo la notificación fallida", example = "15207-2025-JUS/TTAIP")
        String numeroCedulaOriginal,

        @NotBlank(message = "El destinatario afectado es obligatorio")
        @Schema(description = "Destinatario afectado por la notificación fallida", example = "ENTIDAD_PUBLICA", allowableValues = {"CIUDADANO", "ENTIDAD_PUBLICA"})
        String destinatario,

        @NotBlank(message = "La observación del reproceso es obligatoria")
        @Schema(description = "Motivo funcional del reproceso", example = "Cargo de notificación observado; corresponde emitir nueva cédula al mismo destinatario.")
        String observacion,

        @Schema(description = "Responsable que registra el reproceso", example = "Mesa de Partes TTAIP")
        String responsable
) {
}
