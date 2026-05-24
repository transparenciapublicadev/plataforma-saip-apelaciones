package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Registro de encauzamiento SAIP a entidad competente")
public record RegistrarEncauzamientoSolicitudRequest(
        @NotNull(message = "La entidad destino es obligatoria")
        @Schema(description = "ID de la entidad pública competente que recibirá el encauzamiento", example = "2")
        Long entidadDestinoId,

        @NotBlank(message = "El motivo de encauzamiento es obligatorio")
        @Size(max = 3000, message = "El motivo de encauzamiento no puede exceder 3000 caracteres")
        @Schema(description = "Motivo formal por el que la entidad receptora no es competente", example = "La información solicitada corresponde al Ministerio de Educación.")
        String motivoEncauzamiento,

        @NotBlank(message = "El alcance del encauzamiento es obligatorio")
        @Schema(description = "Alcance del encauzamiento", example = "TOTAL", allowableValues = {"TOTAL", "PARCIAL"})
        String alcance,

        @Schema(description = "Responsable que registra el encauzamiento", example = "Funcionario de Transparencia")
        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        String responsable,

        @Schema(description = "Sustento u observación complementaria", example = "Se deriva solo el extremo referido a planillas históricas.")
        @Size(max = 6000, message = "La observación o sustento no puede exceder 6000 caracteres")
        String observacionSustento
) {
}
