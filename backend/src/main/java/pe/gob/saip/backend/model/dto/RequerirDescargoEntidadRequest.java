package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

@Schema(description = "Requerimiento de descargos a entidad pública dentro de un expediente TTAIP")
public record RequerirDescargoEntidadRequest(
        @Schema(description = "Fecha del requerimiento. Si no se envía, se usa la fecha actual.", example = "2026-05-25")
        LocalDate fechaRequerimiento,

        @Size(max = 120, message = "El responsable TTAIP no puede exceder 120 caracteres")
        @Schema(description = "Responsable TTAIP que registra el requerimiento", example = "Secretaría Técnica TTAIP")
        String responsableTtaip,

        @Size(max = 2000, message = "La observación no puede exceder 2000 caracteres")
        @Schema(description = "Observación o sustento del requerimiento", example = "Se requiere expediente administrativo y descargos de la entidad.")
        String observacion
) {
}
