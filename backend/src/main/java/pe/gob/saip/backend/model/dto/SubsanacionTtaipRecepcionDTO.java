package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import java.util.List;
import io.swagger.v3.oas.annotations.media.Schema;

/** A committed receipt; later workflow changes do not change this acknowledgement. */
public record SubsanacionTtaipRecepcionDTO(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long apelacionId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long requerimientoId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String expediente,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "uuid") String claveOperacion,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) LocalDateTime fechaRecepcion,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String fundamentosAdicionales,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = "RECIBIDA") String estado,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<DocumentoMetadataDTO> documentos) {}
