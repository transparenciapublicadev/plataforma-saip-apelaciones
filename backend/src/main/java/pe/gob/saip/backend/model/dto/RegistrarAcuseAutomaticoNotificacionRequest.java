package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Schema(description = "Registro de acuse automático de una notificación TTAIP")
public record RegistrarAcuseAutomaticoNotificacionRequest(
        @NotBlank(message = "El estado del acuse es obligatorio")
        @Schema(
                description = "Estado del acuse automático",
                example = "ENTREGADO",
                allowableValues = {"ENTREGADO", "FALLIDO", "NO_RECIBIDO", "OBSERVADO"}
        )
        String estadoAcuse,

        @NotBlank(message = "El acuse automático es obligatorio")
        @Schema(description = "Contenido, resumen o código del acuse automático")
        String acuseAutomatico,

        @Schema(description = "Fecha y hora del acuse. Si se omite, se usa la fecha actual.", example = "2026-05-25T10:15:00")
        LocalDateTime fechaAcuse,

        @Schema(description = "Resultado funcional de la notificación")
        String resultadoNotificacion,

        @Size(max = 500, message = "La URL de evidencia no puede exceder 500 caracteres")
        @Schema(description = "URL interna o referencia descargable de evidencia")
        String evidenciaUrl,

        @Size(max = 500, message = "La referencia de evidencia no puede exceder 500 caracteres")
        @Schema(description = "Referencia documental alternativa de evidencia")
        String referenciaEvidencia,

        @Schema(description = "Responsable que registra el acuse", example = "Sistema de notificaciones TTAIP")
        String responsable,

        @Schema(description = "Observación operativa adicional")
        String observacion
) {
}
