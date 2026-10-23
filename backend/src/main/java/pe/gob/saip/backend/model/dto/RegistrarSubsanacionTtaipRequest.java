package pe.gob.saip.backend.model.dto;

import java.util.List;
import java.util.UUID;
import org.springframework.web.multipart.MultipartFile;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

/** All selected bytes are received together; no client document IDs are accepted. */
public record RegistrarSubsanacionTtaipRequest(
    @NotNull UUID claveOperacion,
    @NotBlank String fundamentosAdicionales,
    @Schema(description = "Adjuntos seleccionados. Todos deben almacenarse para confirmar; no hay exigencias documentales estructuradas en el modelo vigente.")
    List<MultipartFile> archivos) {}
