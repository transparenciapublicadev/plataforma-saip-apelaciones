package pe.gob.saip.backend.model.dto;

import java.util.List;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

/** One retryable submission; document identifiers and storage paths are never inputs. */
public record RegistrarRespuestaSaipRequest(
        @NotNull UUID claveOperacion,
        @NotBlank @Pattern(regexp = "ENTREGA_TOTAL|ENTREGA_PARCIAL|DENEGACION_TOTAL")
        @Schema(allowableValues = {"ENTREGA_TOTAL", "ENTREGA_PARCIAL", "DENEGACION_TOTAL"}) String tipoRespuesta,
        @NotBlank @Size(min = 1, max = 5000) String contenido,
        @Size(max = 500) String causalDenegatoria,
        @Size(max = 2000) String fundamentoLegal,
        String formatoEntrega,
        Integer plazoEntrega,
        @Schema(description = "Se deriva del funcionario autenticado; un administrador puede indicar el funcionario según la autorización existente.") Long funcionarioId,
        @ArraySchema(schema = @Schema(type = "string", format = "binary"))
        List<MultipartFile> archivos) {
}
