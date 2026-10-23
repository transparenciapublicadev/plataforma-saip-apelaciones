package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.Administrador;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;
import pe.gob.saip.backend.model.entity.Usuario;

@Schema(description = "Usuario del sistema visible para administración")
public record UsuarioAdminDTO(
        Long id,
        String email,
        String tipoUsuario,
        String fechaRegistro,
        Boolean activo,
        String nombre,
        Long entidadId
) {
    public static UsuarioAdminDTO from(Usuario usuario) {
        Long entidadId = null;
        if (usuario instanceof Funcionario funcionario && funcionario.getEntidad() != null) {
            entidadId = funcionario.getEntidad().getId();
        }
        return new UsuarioAdminDTO(
                usuario.getIdUsuario(),
                usuario.getEmail(),
                usuario.getTipoUsuario() != null ? usuario.getTipoUsuario().name() : null,
                usuario.getFechaRegistro() != null ? usuario.getFechaRegistro().toString() : null,
                usuario.getActivo(),
                nombre(usuario),
                entidadId
        );
    }

    private static String nombre(Usuario usuario) {
        if (usuario instanceof Ciudadano ciudadano) {
            return ciudadano.getNombreCompleto();
        }
        if (usuario instanceof Funcionario funcionario) {
            return funcionario.getNombreCompleto();
        }
        if (usuario instanceof MiembroTTAIP miembro) {
            return miembro.getNombreCompleto();
        }
        if (usuario instanceof Administrador administrador) {
            return administrador.getNombreCompleto();
        }
        return usuario.getEmail();
    }
}
