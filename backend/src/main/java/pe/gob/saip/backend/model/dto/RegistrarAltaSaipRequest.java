package pe.gob.saip.backend.model.dto;

import java.util.List;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;

/** Narrow citizen submission. Identity, state, dates and document IDs are not inputs. */
public record RegistrarAltaSaipRequest(
    @NotNull UUID claveOperacion,
    @NotNull @Positive @Schema(minimum="1") Long entidadId,
    @NotBlank @Size(min=1,max=500) String asunto,
    @NotBlank String descripcion,
    @Size(max=100) String tipoInformacion,
    @NotNull Boolean formatoDigital,
    @NotNull Boolean formatoFisico,
    @NotNull Boolean copiaSimple,
    @NotNull Boolean copiaCertificada,
    @NotNull @AssertTrue @Schema(description="Debe ser true: aceptación expresa de tratamiento de datos") Boolean consentimientoDatosPersonales,
    @NotNull @AssertTrue @Schema(description="Debe ser true: declaración expresa del formulario; no es firma digital") Boolean declaraVeracidad,
    @NotBlank @Pattern(regexp="CORREO_ELECTRONICO|CASILLA_ELECTRONICA|PLATAFORMA|FISICA")
    @Schema(allowableValues={"CORREO_ELECTRONICO","CASILLA_ELECTRONICA","PLATAFORMA","FISICA"}) String canalNotificacion,
    @ArraySchema(schema=@Schema(type="string",allowableValues={"SOLICITUD_ORIGINAL","DOCUMENTO_ADJUNTO"}))
    List<@Pattern(regexp="SOLICITUD_ORIGINAL|DOCUMENTO_ADJUNTO") String> tiposDocumento,
    @ArraySchema(schema=@Schema(type="string",format="binary")) List<MultipartFile> archivos) {}
