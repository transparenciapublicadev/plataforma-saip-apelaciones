package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;

@Schema(description = "Solicitud para actualizar un usuario desde administración")
public record ActualizarUsuarioAdminRequest(
        @Email String email,
        String nombre,
        @Pattern(regexp = "CIUDADANO|FUNCIONARIO|TTAIP|ADMINISTRADOR") String tipoUsuario,
        Boolean activo,
        Long entidadId
) {
}
