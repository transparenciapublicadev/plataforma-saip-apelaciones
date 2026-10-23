package pe.gob.saip.backend.model.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CrearUsuarioAdminRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Pattern(regexp = "CIUDADANO|FUNCIONARIO|TTAIP|ADMINISTRADOR") String tipoUsuario,
        String nombre,
        Long entidadId
) {
}
