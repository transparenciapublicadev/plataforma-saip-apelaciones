package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** A persisted registration and its exact document manifest, not delivery or signature evidence. */
@Schema(description = "Recepción persistida de respuesta y todos sus archivos seleccionados. No acredita entrega, notificación eficaz, firma ni emisión oficial.")
public record RespuestaSaipRecepcionDTO(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long solicitudId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String claveOperacion,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDateTime fechaRecepcion,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) RespuestaDTO respuesta,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DocumentoMetadataDTO> documentos) {
}
