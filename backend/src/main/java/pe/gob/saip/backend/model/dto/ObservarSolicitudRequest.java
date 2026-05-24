package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Solicitud para observar una SAIP dentro de los 2 primeros días hábiles")
public record ObservarSolicitudRequest(
        @NotBlank(message = "El motivo de observación es obligatorio")
        @Size(max = 3000, message = "El motivo de observación no puede exceder 3000 caracteres")
        @Schema(description = "Motivo formal de observación", example = "El pedido no identifica con claridad la información solicitada.")
        String motivoObservacion,

        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        @Schema(description = "Responsable que registra la observación", example = "Mesa de Partes de la entidad")
        String responsable
) {
}
