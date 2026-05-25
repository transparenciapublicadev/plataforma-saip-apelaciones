package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Presentación de descargo y expediente administrativo por la entidad pública")
public record PresentarDescargoEntidadRequest(
        @Schema(description = "Fecha de presentación. Si no se envía, se usa la fecha actual.", example = "2026-05-27")
        LocalDate fechaPresentacion,

        @NotBlank(message = "El resumen del descargo es obligatorio")
        @Size(max = 5000, message = "El resumen del descargo no puede exceder 5000 caracteres")
        @Schema(description = "Resumen del descargo presentado", example = "La entidad remite expediente administrativo y sustenta la atención otorgada.")
        String resumenDescargo,

        @Size(max = 500, message = "La referencia del documento no puede exceder 500 caracteres")
        @Schema(description = "Referencia del documento o cargo adjunto", example = "EXP-ADM-2026-00015.pdf")
        String referenciaDocumento,

        @NotBlank(message = "El responsable de la entidad es obligatorio")
        @Size(max = 120, message = "El responsable de la entidad no puede exceder 120 caracteres")
        @Schema(description = "Responsable que presenta el descargo", example = "Funcionario de Transparencia")
        String responsableEntidad,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación adicional", example = "Se adjunta cargo de remisión del expediente administrativo.")
        String observacion
) {
}
