package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Solicitud de envío mediante el motor común de notificaciones")
public record EnviarNotificacionRequest(
        @NotBlank(message = "El asunto de la notificación es obligatorio")
        @Size(max = 300, message = "El asunto no puede exceder 300 caracteres")
        String asunto,

        @NotBlank(message = "El contenido de la notificación es obligatorio")
        @Size(max = 10000, message = "El contenido no puede exceder 10000 caracteres")
        String contenido,

        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        String responsable,

        @Schema(description = "Solo se admite en modo MOCK para validar fallos controlados en desarrollo y Newman")
        Boolean forzarFalloMock
) {
}
