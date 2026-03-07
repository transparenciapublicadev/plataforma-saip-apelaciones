package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;

@Schema(description = "Datos de registro de ciudadano")
public record RegistroRequestDTO(
        @NotBlank(message = "El email es requerido")
        @Email(message = "Formato de email inválido")
        @Schema(description = "Email del ciudadano", example = "ciudadano@email.com")
        String email,

        @NotBlank(message = "La contraseña es requerida")
        @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres")
        @Schema(description = "Contraseña (mín 6 caracteres)")
        String password,

        @NotBlank(message = "El DNI es requerido")
        @Pattern(regexp = "\\d{8}", message = "El DNI debe tener exactamente 8 dígitos numéricos")
        @Schema(description = "DNI de 8 dígitos", example = "12345678")
        String dni,

        @NotBlank(message = "El nombre completo es requerido")
        @Size(max = 200, message = "El nombre no puede exceder 200 caracteres")
        @Schema(description = "Nombre completo del ciudadano")
        String nombreCompleto,

        @Size(max = 15, message = "El teléfono no puede exceder 15 caracteres")
        @Schema(description = "Número de teléfono", example = "987654321")
        String telefono,

        @Size(max = 300, message = "La dirección no puede exceder 300 caracteres")
        String direccion
) {}
