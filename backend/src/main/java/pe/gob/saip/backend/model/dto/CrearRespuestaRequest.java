package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Datos para crear respuesta a solicitud SAIP")
public record CrearRespuestaRequest(
    @NotNull(message = "El ID de la solicitud es obligatorio")
    Long solicitudId,

    Long funcionarioId,

    @NotBlank(message = "El tipo de respuesta es obligatorio")
    @Schema(description = "Tipo de respuesta", example = "ENTREGA_TOTAL", allowableValues = {"ENTREGA_TOTAL", "ENTREGA_PARCIAL", "DENEGACION_TOTAL"})
    String tipoRespuesta,

    @NotBlank(message = "El contenido es obligatorio")
    @Size(max = 5000, message = "El contenido no puede exceder 5000 caracteres")
    String contenido,

    @Size(max = 500, message = "La causal denegatoria no puede exceder 500 caracteres")
    String causalDenegatoria,

    @Size(max = 2000, message = "El fundamento legal no puede exceder 2000 caracteres")
    String fundamentoLegal,

    String formatoEntrega,

    Integer plazoEntrega
) {}
