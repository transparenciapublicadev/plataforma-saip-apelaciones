package pe.gob.saip.backend.model.dto;

import java.util.UUID;

import org.springframework.web.multipart.MultipartFile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Multipart command requiring the precision text, bytes and a stable retry key. */
public record RegistrarPrecisionSaipRequest(
        @NotBlank @Size(min = 1, max = 3000) String comentario,
        @NotNull UUID claveOperacion,
        @NotNull @Schema(type = "string", format = "binary") MultipartFile archivo) {
}
