package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.ApiProblemDetails;
import pe.gob.saip.backend.model.dto.LoginRequestDTO;
import pe.gob.saip.backend.model.dto.RegistroRequestDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.security.JwtService;
import pe.gob.saip.backend.service.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticación", description = "Registro de ciudadanos y login con JWT")
public class AuthRestController {

    private final UsuarioService usuarioService;
    private final CiudadanoService ciudadanoService;
    private final FuncionarioService funcionarioService;
    private final MiembroTTAIPService miembroTTAIPService;
    private final AdministradorService administradorService;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthRestController(UsuarioService usuarioService,
                               CiudadanoService ciudadanoService,
                               FuncionarioService funcionarioService,
                               MiembroTTAIPService miembroTTAIPService,
                               AdministradorService administradorService,
                               JwtService jwtService,
                               PasswordEncoder passwordEncoder) {
        this.usuarioService = usuarioService;
        this.ciudadanoService = ciudadanoService;
        this.funcionarioService = funcionarioService;
        this.miembroTTAIPService = miembroTTAIPService;
        this.administradorService = administradorService;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
    }

    @Operation(summary = "Iniciar sesión", description = "Autentica al usuario y retorna un token JWT con datos del perfil según su rol. Acepta email, DNI (8 dígitos) o nombre de usuario como identificador.")
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestDTO request,
                                   HttpServletRequest servletRequest) {
        Optional<Usuario> usuarioOpt = resolverUsuario(request.identificador());

        if (usuarioOpt.isEmpty()) {
            return problem(HttpStatus.UNAUTHORIZED, "Unauthorized", "Usuario no encontrado", servletRequest);
        }

        Usuario usuario = usuarioOpt.get();

        // Soporta BCrypt y migración de contraseñas legacy (plaintext)
        if (!verificarPassword(request.password(), usuario)) {
            return problem(HttpStatus.UNAUTHORIZED, "Unauthorized", "Contraseña incorrecta", servletRequest);
        }

        if (!usuario.getActivo()) {
            return problem(HttpStatus.UNAUTHORIZED, "Unauthorized", "Usuario desactivado", servletRequest);
        }

        // Generar JWT token
        String token = jwtService.generateToken(
                usuario.getEmail(),
                usuario.getTipoUsuario().name(),
                usuario.getIdUsuario());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("token", token);
        response.put("usuarioId", usuario.getIdUsuario());
        response.put("email", usuario.getEmail());
        response.put("tipoUsuario", usuario.getTipoUsuario().name());

        switch (usuario.getTipoUsuario()) {
            case CIUDADANO -> {
                ciudadanoService.findById(usuario.getIdUsuario()).ifPresent(c -> {
                    response.put("nombre", c.getNombreCompleto());
                    response.put("dni", c.getDni());
                    response.put("ciudadanoId", c.getId());
                });
                response.put("redirectUrl", "/ciudadano/dashboard");
            }
            case FUNCIONARIO -> {
                funcionarioService.obtenerFuncionarioPorId(usuario.getIdUsuario()).ifPresent(f -> {
                    response.put("nombre", f.getNombreCompleto());
                    response.put("cargo", f.getCargo());
                    response.put("funcionarioId", f.getId());
                    if (f.getEntidad() != null) {
                        response.put("entidadId", f.getEntidad().getId());
                        response.put("entidadNombre", f.getEntidad().getNombre());
                    }
                });
                response.put("redirectUrl", "/entidad/dashboard");
            }
            case TTAIP -> {
                miembroTTAIPService.obtenerMiembroTTAIPPorId(usuario.getIdUsuario()).ifPresent(m -> {
                    response.put("nombre", m.getNombreCompleto());
                    response.put("cargo", m.getCargo());
                    response.put("miembroId", m.getIdUsuario());
                });
                response.put("redirectUrl", "/ttaip/dashboard");
            }
            case ADMINISTRADOR -> {
                administradorService.obtenerAdministradorPorId(usuario.getIdUsuario()).ifPresent(a -> {
                    response.put("nombre", a.getNombreCompleto());
                    response.put("administradorId", a.getId());
                });
                response.put("redirectUrl", "/admin/dashboard");
            }
        }

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Registrar ciudadano", description = "Registra un nuevo ciudadano en el sistema con email, DNI y datos personales")
    @PostMapping("/registro")
    public ResponseEntity<?> registro(@Valid @RequestBody RegistroRequestDTO request,
                                      HttpServletRequest servletRequest) {
        if (usuarioService.obtenerUsuarioPorEmail(request.email()).isPresent()) {
            return problem(HttpStatus.CONFLICT, "Conflict", "Ya existe un usuario con ese email", servletRequest);
        }

        if (ciudadanoService.obtenerCiudadanoPorDni(request.dni()).isPresent()) {
            return problem(HttpStatus.CONFLICT, "Conflict", "Ya existe un ciudadano con ese DNI", servletRequest);
        }

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setEmail(request.email());
        ciudadano.setPassword(passwordEncoder.encode(request.password()));
        ciudadano.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        ciudadano.setActivo(true);
        ciudadano.setDni(request.dni());
        ciudadano.setNombreCompleto(request.nombreCompleto());
        ciudadano.setTelefono(request.telefono());
        ciudadano.setDireccion(request.direccion());

        ciudadano = ciudadanoService.guardarCiudadano(ciudadano);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "success", true,
                "mensaje", "Registro exitoso",
                "ciudadanoId", ciudadano.getId(),
                "email", ciudadano.getEmail()
        ));
    }

    @Operation(summary = "Verificar disponibilidad de email")
    @GetMapping("/verificar-email")
    public ResponseEntity<Map<String, Object>> verificarEmail(@RequestParam String email) {
        boolean existe = usuarioService.obtenerUsuarioPorEmail(email).isPresent();
        return ResponseEntity.ok(Map.of("existe", existe));
    }

    @Operation(summary = "Verificar disponibilidad de DNI")
    @GetMapping("/verificar-dni")
    public ResponseEntity<Map<String, Object>> verificarDni(@RequestParam String dni) {
        boolean existe = ciudadanoService.obtenerCiudadanoPorDni(dni).isPresent();
        return ResponseEntity.ok(Map.of("existe", existe));
    }

    @Operation(summary = "Obtener usuario actual", description = "Retorna los datos básicos del usuario autenticado")
    @GetMapping("/me/{usuarioId}")
    public ResponseEntity<Map<String, Object>> obtenerUsuarioActual(@PathVariable Long usuarioId) {
        Optional<Usuario> usuarioOpt = usuarioService.obtenerUsuarioPorId(usuarioId);

        if (usuarioOpt.isEmpty()) {
            throw new pe.gob.saip.backend.exception.RecursoNoEncontradoException(
                    "Usuario no encontrado con ID: " + usuarioId);
        }

        Usuario usuario = usuarioOpt.get();

        Map<String, Object> response = new HashMap<>();
        response.put("usuarioId", usuario.getIdUsuario());
        response.put("email", usuario.getEmail());
        response.put("tipoUsuario", usuario.getTipoUsuario().name());
        response.put("activo", usuario.getActivo());

        return ResponseEntity.ok(response);
    }

    /**
     * Verifica contraseña con soporte para migración BCrypt.
     * Si la contraseña almacenada es plaintext (legacy), la compara directamente
     * y la re-codifica con BCrypt para futuros logins.
     */
    /**
     * Resuelve el usuario a partir de un identificador genérico:
     * - Contiene '@' → búsqueda por email
     * - 8 dígitos exactos → búsqueda por DNI (Ciudadano)
     * - Otro → intento por email como fallback
     */
    private Optional<Usuario> resolverUsuario(String identificador) {
        if (identificador.contains("@")) {
            return usuarioService.obtenerUsuarioPorEmail(identificador);
        }
        if (identificador.matches("\\d{8}")) {
            return ciudadanoService.obtenerCiudadanoPorDni(identificador)
                    .map(c -> (Usuario) c);
        }
        return usuarioService.obtenerUsuarioPorEmail(identificador);
    }

    private boolean verificarPassword(String rawPassword, Usuario usuario) {
        String storedPassword = usuario.getPassword();

        if (storedPassword.startsWith("$2")) {
            // Contraseña ya codificada con BCrypt
            return passwordEncoder.matches(rawPassword, storedPassword);
        }

        // Contraseña legacy (plaintext) — migrar a BCrypt
        if (storedPassword.equals(rawPassword)) {
            usuario.setPassword(passwordEncoder.encode(rawPassword));
            usuarioService.guardarUsuario(usuario);
            return true;
        }

        return false;
    }

    private ResponseEntity<ProblemDetail> problem(HttpStatus status,
                                                  String title,
                                                  String detail,
                                                  HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(status, title, detail, request.getRequestURI());
        return ResponseEntity.status(status).body(problem);
    }
}
