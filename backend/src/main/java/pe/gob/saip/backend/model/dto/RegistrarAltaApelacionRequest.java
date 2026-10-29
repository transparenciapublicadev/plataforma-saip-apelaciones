package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Apelacion;

/** Discriminated citizen submission; identity and state are exclusively server derived. */
@Schema(additionalProperties=Schema.AdditionalPropertiesValue.FALSE,description="DIRECTA_TTAIP: solicitudId y copia de SAIP, más respuesta cuando exista. ANTE_ENTIDAD añade fecha no futura y referencia de cargo; fundamentos hasta 5000. EXTERNA: sin solicitudId, entidad de catálogo o declarada, número/fecha/resumen/referencia de SAIP y fundamentos hasta 5000; expresa requiere fecha y resumen o referencia de respuesta, tácita requiere evidencia declarada de silencio. Documentos externos opcionales. No se recibe identidad, estado ni fechas de alta.")
public record RegistrarAltaApelacionRequest(
        @NotNull UUID claveOperacion,
        @NotBlank @Pattern(regexp="DIRECTA_TTAIP|ANTE_ENTIDAD|EXTERNA")
        @Schema(allowableValues={"DIRECTA_TTAIP","ANTE_ENTIDAD","EXTERNA"}) String modalidad,
        @Positive @Schema(minimum="1") Long solicitudId,
        @NotBlank String fundamentos,
        @Positive @Schema(minimum="1") Long entidadId,
        @Size(max=200) String entidadExternaNombre,
        @Size(max=20) String entidadExternaRuc,
        @Email @Size(max=120) String entidadExternaEmail,
        @Size(max=100) String numeroSolicitudExterna,
        LocalDate fechaPresentacionSolicitudExterna,
        LocalDate fechaRespuestaEntidad,
        Apelacion.TipoDenegatoria tipoDenegatoria,
        @Size(max=5000) String resumenSolicitudOriginal,
        @Size(max=5000) String resumenRespuestaEntidad,
        @Size(max=500) String referenciaDocumentoSolicitud,
        @Size(max=500) String referenciaCargoRecepcion,
        @Size(max=500) String referenciaRespuestaEntidad,
        @Size(max=5000) String evidenciaSilencioAdministrativo,
        @Size(max=5000) String observacion,
        LocalDate fechaPresentacionAnteEntidad,
        @Size(max=500) String referenciaCargoPresentacion,
        @NotNull List<@Valid DocumentoAltaApelacionRequest> documentos) {
    @com.fasterxml.jackson.annotation.JsonAnySetter
    public void desconocido(String name, Object value) { throw new IllegalArgumentException("El alta contiene atributos no permitidos"); }
}
