package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "Credenciales de inicio de sesión")
public record LoginRequestDTO(
        @NotBlank(message = "El identificador es requerido")
        @Schema(description = "Identificador del usuario: email, DNI (8 dígitos) o usuario",
                example = "ciudadano@email.com")
        String identificador,

        @NotBlank(message = "La contraseña es requerida")
        @Schema(description = "Contraseña")
        String password
) {}
