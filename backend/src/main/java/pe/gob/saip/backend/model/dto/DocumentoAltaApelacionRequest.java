package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

/** A source ID is a request to copy an authorized version, never an association by ID alone. */
@Schema(additionalProperties=Schema.AdditionalPropertiesValue.FALSE)
public record DocumentoAltaApelacionRequest(
        @NotBlank @Pattern(regexp="SOLICITUD_ORIGINAL|RESPUESTA_ENTIDAD|RECURSO_APELACION|DOCUMENTO_ADJUNTO")
        @Schema(allowableValues={"SOLICITUD_ORIGINAL","RESPUESTA_ENTIDAD","RECURSO_APELACION","DOCUMENTO_ADJUNTO"}) String tipoDocumento,
        @Positive @Schema(minimum="1",description="Antecedente de la SAIP/respuesta de origen. Ausente consume el siguiente archivo multipart") Long origenId,
        @Pattern(regexp="[a-f0-9]{64}") @Schema(description="SHA-256 de la versión del antecedente seleccionada, obligatorio con origenId") String hashOrigen) {
    @com.fasterxml.jackson.annotation.JsonAnySetter
    public void desconocido(String name, Object value) { throw new IllegalArgumentException("El documento contiene atributos no permitidos"); }
}
