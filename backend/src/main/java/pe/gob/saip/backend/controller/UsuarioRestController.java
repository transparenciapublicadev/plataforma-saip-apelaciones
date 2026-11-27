package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ActualizarUsuarioAdminRequest;
import pe.gob.saip.backend.model.dto.CrearUsuarioAdminRequest;
import pe.gob.saip.backend.model.dto.UsuarioAdminDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.EntidadService;
import pe.gob.saip.backend.service.UsuarioService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@Tag(name = "Usuarios", description = "Administración de usuarios del sistema")
public class UsuarioRestController {

    private final UsuarioService usuarioService;
    private final EntidadService entidadService;
    private final PasswordEncoder passwordEncoder;

    public UsuarioRestController(UsuarioService usuarioService,
                                 EntidadService entidadService,
                                 PasswordEncoder passwordEncoder) {
        this.usuarioService = usuarioService;
        this.entidadService = entidadService;
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

        Usuario.TipoUsuario tipo = Usuario.TipoUsuario.valueOf(request.tipoUsuario());
        String encodedPassword = passwordEncoder.encode(request.password());
        Usuario usuario;

        switch (tipo) {
            case CIUDADANO -> {
                Ciudadano c = new Ciudadano();
                c.setEmail(request.email());
                c.setPassword(encodedPassword);
                c.setTipoUsuario(tipo);
                c.setActivo(true);
                if (request.nombre() != null && !request.nombre().isBlank()) {
                    c.setNombreCompleto(request.nombre().trim());
                    c.setNombres(request.nombre().trim());
                }
                usuario = c;
            }
            case FUNCIONARIO -> {
                Funcionario f = new Funcionario();
                f.setEmail(request.email());
                f.setPassword(encodedPassword);
                f.setTipoUsuario(tipo);
                f.setActivo(true);
                f.setNombreCompleto(request.nombre() != null && !request.nombre().isBlank() ? request.nombre().trim() : request.email());
                if (request.entidadId() != null) {
                    Entidad entidad = entidadService.findById(request.entidadId())
                            .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + request.entidadId()));
                    f.setEntidad(entidad);
                }
                usuario = f;
            }
            case TTAIP -> {
                MiembroTTAIP m = new MiembroTTAIP();
                m.setEmail(request.email());
                m.setPassword(encodedPassword);
                m.setTipoUsuario(tipo);
                m.setActivo(true);
                m.setNombreCompleto(request.nombre() != null && !request.nombre().isBlank() ? request.nombre().trim() : request.email());
                usuario = m;
            }
            case ADMINISTRADOR -> {
                Administrador a = new Administrador();
                a.setEmail(request.email());
                a.setPassword(encodedPassword);
                a.setTipoUsuario(tipo);
                a.setActivo(true);
                a.setNombreCompleto(request.nombre() != null && !request.nombre().isBlank() ? request.nombre().trim() : request.email());
                a.setRol("ADMINISTRADOR");
                usuario = a;
            }
            default -> {
                usuario = new Usuario();
                usuario.setEmail(request.email());
                usuario.setPassword(encodedPassword);
                usuario.setTipoUsuario(tipo);
                usuario.setActivo(true);
            }
        }

        usuarioService.guardarUsuario(usuario);
        return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioAdminDTO.from(usuario));
    }

    @Operation(summary = "Actualizar usuario")
    @PutMapping("/{id}")
    public ResponseEntity<UsuarioAdminDTO> actualizar(@PathVariable Long id, @Valid @RequestBody ActualizarUsuarioAdminRequest request) {
        Usuario usuario = usuarioService.obtenerUsuarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado con ID: " + id));

        if (request.email() != null && !request.email().isBlank() && !request.email().equalsIgnoreCase(usuario.getEmail())) {
            if (usuarioService.obtenerUsuarioPorEmail(request.email()).isPresent()) {
                throw new IllegalArgumentException("Ya existe un usuario con ese email");
            }
            usuario.setEmail(request.email().trim());
        }

        if (request.tipoUsuario() != null && !request.tipoUsuario().isBlank()) {
            usuario.setTipoUsuario(Usuario.TipoUsuario.valueOf(request.tipoUsuario()));
        }

        if (request.nombre() != null && !request.nombre().isBlank()) {
            String nombre = request.nombre().trim();
            if (usuario instanceof Ciudadano c) {
                c.setNombreCompleto(nombre);
                c.setNombres(nombre);
            } else if (usuario instanceof Funcionario f) {
                f.setNombreCompleto(nombre);
            } else if (usuario instanceof MiembroTTAIP m) {
                m.setNombreCompleto(nombre);
            } else if (usuario instanceof Administrador a) {
                a.setNombreCompleto(nombre);
            }
        }

        if (request.entidadId() != null && usuario instanceof Funcionario f) {
            Entidad entidad = entidadService.findById(request.entidadId())
                    .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + request.entidadId()));
            f.setEntidad(entidad);
        }

        usuario = usuarioService.guardarUsuario(usuario, request.activo());
        return ResponseEntity.ok(UsuarioAdminDTO.from(usuario));
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

        usuario = usuarioService.cambiarEstado(id, activo);
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
