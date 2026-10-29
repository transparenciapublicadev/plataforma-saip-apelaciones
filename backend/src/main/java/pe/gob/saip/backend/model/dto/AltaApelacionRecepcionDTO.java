package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description="Recepción persistida y manifiesto exacto. La apelación refleja el recurso actual, no una fotografía de todos sus campos mutables. No acredita notificación eficaz, admisión, entrega, firma ni emisión.")
public record AltaApelacionRecepcionDTO(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long id,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,format="uuid") String claveOperacion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String modalidad,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) LocalDateTime fechaRecepcion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) ApelacionDTO apelacion,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<AltaApelacionDocumentoDTO> documentos) {}
