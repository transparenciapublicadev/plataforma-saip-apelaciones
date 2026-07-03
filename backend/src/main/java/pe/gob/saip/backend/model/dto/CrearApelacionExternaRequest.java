package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.gob.saip.backend.model.entity.Apelacion;

import java.time.LocalDate;

@Schema(description = "Registro de una apelación TTAIP originada por una SAIP tramitada fuera de la plataforma")
public record CrearApelacionExternaRequest(
        @NotNull Long ciudadanoId,
        Long entidadId,
        @Size(max = 200) String entidadExternaNombre,
        @Size(max = 20) String entidadExternaRuc,
        @Email @Size(max = 120) String entidadExternaEmail,
        @NotBlank @Size(max = 100) String numeroSolicitudExterna,
        @NotNull LocalDate fechaPresentacionSolicitudExterna,
        LocalDate fechaRespuestaEntidad,
        @NotNull
        @Schema(description = "Tipo de denegatoria de la SAIP", example = "EXPRESA", implementation = Apelacion.TipoDenegatoria.class, allowableValues = {"EXPRESA", "TACITA"})
        Apelacion.TipoDenegatoria tipoDenegatoria,
        @NotBlank @Size(max = 5000) String resumenSolicitudOriginal,
        @Size(max = 5000) String resumenRespuestaEntidad,
        @NotBlank @Size(max = 500) String referenciaDocumentoSolicitud,
        @Size(max = 500) String referenciaCargoRecepcion,
        @Size(max = 500) String referenciaRespuestaEntidad,
        @Size(max = 5000) String evidenciaSilencioAdministrativo,
        @NotBlank @Size(max = 5000) String fundamentos,
        @Size(max = 5000) String observacion
) {
}
