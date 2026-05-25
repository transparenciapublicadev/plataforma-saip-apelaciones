package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Comunicación de cumplimiento de resolución fundada por la entidad pública")
public record RegistrarCumplimientoResolucionRequest(
        @Schema(description = "Fecha en la que la entidad comunica el cumplimiento. Si no se envía, se usa la fecha actual.", example = "2026-06-04")
        LocalDate fechaCumplimiento,

        @NotBlank(message = "El tipo de cumplimiento es obligatorio")
        @Schema(description = "Tipo de cumplimiento comunicado", allowableValues = {"TOTAL", "PARCIAL", "NO_CUMPLE"}, example = "TOTAL")
        String tipoCumplimiento,

        @NotBlank(message = "La descripción del cumplimiento es obligatoria")
        @Size(max = 5000, message = "La descripción del cumplimiento no puede exceder 5000 caracteres")
        @Schema(description = "Detalle de cómo la entidad cumplió la resolución", example = "La entidad entregó la información ordenada mediante enlace seguro.")
        String descripcionCumplimiento,

        @Size(max = 500, message = "La evidencia no puede exceder 500 caracteres")
        @Schema(description = "URL o referencia de evidencia de cumplimiento", example = "https://saip.local/evidencias/cumplimiento-0001.pdf")
        String evidenciaCumplimiento,

        @Size(max = 500, message = "La referencia documental no puede exceder 500 caracteres")
        @Schema(description = "Referencia documental interna o cargo", example = "CARGO-CUMP-2026-0001.pdf")
        String referenciaDocumento,

        @NotBlank(message = "El responsable de la entidad es obligatorio")
        @Size(max = 120, message = "El responsable de la entidad no puede exceder 120 caracteres")
        @Schema(description = "Responsable que comunica el cumplimiento", example = "Funcionario de Transparencia")
        String responsableEntidad,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación adicional", example = "Comunicación remitida dentro del plazo legal.")
        String observacion
) {
}
