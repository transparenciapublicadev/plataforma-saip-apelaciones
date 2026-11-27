package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** Committed registration identity and accepted files; nested request is the current authorized resource. */
@Schema(description="Recepción persistida de nueva SAIP y todos sus archivos seleccionados. No acredita entrega, eficacia de notificación, firma ni emisión.")
public record AltaSaipRecepcionDTO(
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long id,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="uuid") String claveOperacion,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) LocalDateTime fechaRecepcion,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Boolean declaraVeracidad,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) SolicitudDTO solicitud,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<DocumentoMetadataDTO> documentos) {}
