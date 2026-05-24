package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "Registro de ampliación de plazo SAIP con informe y cronograma")
public record RegistrarAmpliacionPlazoRequest(
        @NotBlank(message = "El motivo de ampliación es obligatorio")
        @Size(max = 3000, message = "El motivo de ampliación no puede exceder 3000 caracteres")
        @Schema(description = "Motivo formal de ampliación", example = "El pedido comprende un volumen amplio de expedientes físicos por digitalizar.")
        String motivoAmpliacion,

        @NotBlank(message = "El informe de ampliación es obligatorio")
        @Size(max = 6000, message = "El informe de ampliación no puede exceder 6000 caracteres")
        @Schema(description = "Informe que sustenta la ampliación y el cronograma", example = "Informe N.° 001-2026 que sustenta búsqueda, digitalización y entregas parciales.")
        String informeAmpliacion,

        @NotNull(message = "La fecha de notificación de ampliación es obligatoria")
        @Schema(description = "Fecha en que se notificó la ampliación al ciudadano", example = "2026-05-27")
        LocalDate fechaNotificacionAmpliacion,

        @Schema(description = "Responsable que registra y notifica la ampliación", example = "Funcionario de Transparencia")
        @Size(max = 120, message = "El responsable no puede exceder 120 caracteres")
        String responsable,

        @NotEmpty(message = "Debe registrar al menos una entrega parcial")
        @Size(max = 12, message = "El cronograma no puede exceder 12 entregas parciales")
        @Valid
        List<RegistrarEntregaParcialRequest> cronograma
) {
}
