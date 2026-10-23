package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;

import io.swagger.v3.oas.annotations.media.Schema;

/** Persisted acknowledgement of a precision and its stored document. */
@Schema(description = "Recepción confirmada de una precisión SAIP con documento almacenado")
public record PrecisionSaipRecepcionDTO(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long solicitudId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long observacionId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "uuid") String claveOperacion,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDateTime fechaRecepcion,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String comentario,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = "SUBSANADA") String estado,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) DocumentoMetadataDTO documento) {
}
