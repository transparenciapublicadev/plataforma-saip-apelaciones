package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Solicitud de suspensión adicional de plazo TTAIP por informe oral o información complementaria")
public record RegistrarSuspensionTtaipRequest(
        @Schema(description = "Fecha de solicitud de la suspensión. Si se omite, se usa la fecha actual.", example = "2026-05-12")
        LocalDate fechaSolicitud,

        @NotBlank(message = "El solicitante es obligatorio")
        @Schema(description = "Solicitante de la suspensión", example = "CIUDADANO", allowableValues = {
                "CIUDADANO", "ENTIDAD_PUBLICA", "TTAIP"
        })
        String solicitante,

        @NotBlank(message = "El motivo de la suspensión es obligatorio")
        @Size(max = 2000, message = "El motivo no puede exceder 2000 caracteres")
        @Schema(description = "Motivo o sustento del informe oral o información complementaria", example = "Se solicita informe oral para sustentar los argumentos de la apelación.")
        String motivo,

        @NotBlank(message = "El responsable es obligatorio")
        @Size(max = 180, message = "El responsable no puede exceder 180 caracteres")
        @Schema(description = "Responsable que registra la suspensión", example = "Secretaría Técnica TTAIP")
        String responsable,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación operativa opcional", example = "Solicitud registrada durante etapa de resolución final.")
        String observacion
) {
}
