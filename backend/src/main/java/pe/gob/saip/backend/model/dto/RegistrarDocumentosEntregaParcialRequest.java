package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud.Decision;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "Fecha real y archivos de una entrega programada de la SAIP")
public record RegistrarDocumentosEntregaParcialRequest(
        @NotNull @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaEntregaReal,
        @NotNull(message = "Seleccione la decisión para esta entrega") Decision decision,
        @Size(max = 3000) String fundamentoDecision,
        @NotEmpty(message = "Adjunte al menos un documento de la entrega") List<MultipartFile> archivos
) {}
