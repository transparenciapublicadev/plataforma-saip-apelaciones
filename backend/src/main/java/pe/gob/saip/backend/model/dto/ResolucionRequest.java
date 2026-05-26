package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Datos para emitir resolución final de apelación")
public record ResolucionRequest(
    @NotBlank(message = "Los fundamentos son obligatorios")
    @Size(max = 5000, message = "Los fundamentos no pueden exceder 5000 caracteres")
    String fundamentos,

    @Size(max = 5000, message = "El fundamento legal no puede exceder 5000 caracteres")
    String fundamentoLegal,

    @Size(max = 5000, message = "Las observaciones no pueden exceder 5000 caracteres")
    String observaciones,

    Long miembroId,

    Boolean iniciarProcesoDisciplinario
) {}
