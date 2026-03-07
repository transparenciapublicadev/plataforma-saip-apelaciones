package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Datos para calificación de apelación por miembro TTAIP")
public record CalificacionRequest(
    @NotBlank(message = "Los fundamentos son obligatorios")
    @Size(max = 5000, message = "Los fundamentos no pueden exceder 5000 caracteres")
    String fundamentos,

    Long miembroId,

    @Size(max = 2000, message = "Las observaciones no pueden exceder 2000 caracteres")
    String observaciones,

    Integer diasSubsanacion
) {}
