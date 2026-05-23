package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.CrearUsuarioAdminRequest;
import pe.gob.saip.backend.model.dto.UsuarioAdminDTO;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.service.UsuarioService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios", description = "Administración de usuarios del sistema")
public class UsuarioRestController {

    private final UsuarioService usuarioService;
    private final PasswordEncoder passwordEncoder;

    public UsuarioRestController(UsuarioService usuarioService, PasswordEncoder passwordEncoder) {
        this.usuarioService = usuarioService;
        this.passwordEncoder = passwordEncoder;
    }

    @Operation(summary = "Listar usuarios del sistema")
    @GetMapping
    public ResponseEntity<List<UsuarioAdminDTO>> listar() {
        return ResponseEntity.ok(usuarioService.obtenerTodosLosUsuarios()
                .stream()
                .map(UsuarioAdminDTO::from)
                .toList());
    }

    @Operation(summary = "Crear usuario base desde administración")
    @PostMapping
    public ResponseEntity<UsuarioAdminDTO> crear(@Valid @RequestBody CrearUsuarioAdminRequest request) {
        if (usuarioService.obtenerUsuarioPorEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Ya existe un usuario con ese email");
        }

        Usuario usuario = new Usuario();
        usuario.setEmail(request.email());
        usuario.setPassword(passwordEncoder.encode(request.password()));
        usuario.setTipoUsuario(Usuario.TipoUsuario.valueOf(request.tipoUsuario()));
        usuario.setActivo(true);
        usuarioService.guardarUsuario(usuario);

        return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioAdminDTO.from(usuario));
    }

    @Operation(summary = "Activar o desactivar usuario")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<UsuarioAdminDTO> cambiarEstado(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Usuario usuario = usuarioService.obtenerUsuarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado con ID: " + id));

        Boolean activo = body.get("activo");
        if (activo == null) {
            throw new IllegalArgumentException("El campo activo es obligatorio");
        }

        usuario.setActivo(activo);
        usuarioService.guardarUsuario(usuario);
        return ResponseEntity.ok(UsuarioAdminDTO.from(usuario));
    }

    @Operation(summary = "Eliminar usuario")
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@PathVariable Long id) {
        usuarioService.obtenerUsuarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado con ID: " + id));
        usuarioService.eliminarUsuario(id);
        return ResponseEntity.ok(Map.of("mensaje", "Usuario eliminado correctamente", "id", id));
    }
}
