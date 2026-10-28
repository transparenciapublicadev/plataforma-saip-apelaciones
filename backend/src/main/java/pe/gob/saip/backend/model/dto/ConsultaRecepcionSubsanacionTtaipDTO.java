package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** Institutional read model, deliberately excluding the citizen's recovery credentials. */
public record ConsultaRecepcionSubsanacionTtaipDTO(
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long expedienteTtaipId,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long apelacionId,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) Long requerimientoId,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String expediente,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED, allowableValues={"AUSENTE","RECIBIDA"}) String estado,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED, types={"integer","null"}, format="int64") Long recepcionId,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED, types={"string","null"}, format="date-time") LocalDateTime fechaRecepcion,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED, types={"string","null"}) String fundamentosAdicionales,
    @Schema(requiredMode=Schema.RequiredMode.REQUIRED) List<DocumentoMetadataDTO> documentos) {}
