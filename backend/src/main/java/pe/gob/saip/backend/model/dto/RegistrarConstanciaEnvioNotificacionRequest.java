package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

@Schema(description = "Registro operativo de constancia de envío de una notificación TTAIP")
public record RegistrarConstanciaEnvioNotificacionRequest(
        @NotBlank(message = "El medio de notificación es obligatorio")
        @Schema(description = "Medio usado para la notificación", example = "CORREO_ELECTRONICO")
        String medioNotificacion,

        @Schema(description = "Fecha y hora de envío. Si se omite, se usa la fecha actual.", example = "2026-05-25T09:30:00")
        LocalDateTime fechaEnvio,

        @Size(max = 80, message = "El código de envío no puede exceder 80 caracteres")
        @Schema(description = "Código operativo del envío", example = "MAIL-2026-000012")
        String codigoEnvio,

        @Size(max = 80, message = "El código de constancia no puede exceder 80 caracteres")
        @Schema(description = "Código formal de la constancia de envío", example = "CONST-2026-000012")
        String codigoConstancia,

        @NotBlank(message = "La constancia de envío es obligatoria")
        @Schema(description = "Resumen o referencia textual de la constancia emitida")
        String constanciaEnvio,

        @Size(max = 500, message = "La URL de evidencia no puede exceder 500 caracteres")
        @Schema(description = "URL interna o referencia descargable de evidencia")
        String evidenciaUrl,

        @Size(max = 500, message = "La referencia de evidencia no puede exceder 500 caracteres")
        @Schema(description = "Referencia documental alternativa de evidencia")
        String referenciaEvidencia,

        @NotBlank(message = "El responsable de la constancia es obligatorio")
        @Schema(description = "Responsable que registra la constancia", example = "Mesa de Partes TTAIP")
        String responsable,

        @Schema(description = "Observación operativa adicional")
        String observacion
) {
}
