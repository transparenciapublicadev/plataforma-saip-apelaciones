package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** Stored copy plus immutable provenance; no storage keys. */
public record AltaApelacionDocumentoDTO(
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED) DocumentoMetadataDTO documento,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,types={"integer","null"},format="int64") Long origenId,
        @Schema(requiredMode=Schema.RequiredMode.REQUIRED,description="SHA-256 de los bytes aceptados al registrar") String hashAceptado) {}
