package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.FuncionarioDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/funcionarios")
@Tag(name = "Funcionarios", description = "Gestión de funcionarios de entidades públicas")
public class FuncionarioRestController {

    private final FuncionarioService funcionarioService;
    private final EntidadService entidadService;
    private final PasswordEncoder passwordEncoder;
    private final AutorizacionRecursosService autorizacionRecursosService;
    private final UsuarioService usuarioService;

    public FuncionarioRestController(FuncionarioService funcionarioService,
                                      EntidadService entidadService,
                                      PasswordEncoder passwordEncoder,
                                      AutorizacionRecursosService autorizacionRecursosService,
                                      UsuarioService usuarioService) {
        this.funcionarioService = funcionarioService;
        this.entidadService = entidadService;
        this.passwordEncoder = passwordEncoder;
        this.autorizacionRecursosService = autorizacionRecursosService;
        this.usuarioService = usuarioService;
    }

    @Operation(summary = "Listar todos los funcionarios")
    @GetMapping
    public ResponseEntity<List<FuncionarioDTO>> listar() {
        List<FuncionarioDTO> funcionarios = autorizacionRecursosService
                .filtrarFuncionariosAccesibles(funcionarioService.obtenerTodosLosFuncionarios())
                .stream()
                .map(FuncionarioDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(funcionarios);
    }

    @Operation(summary = "Obtener funcionario por ID")
    @GetMapping("/{id}")
    public ResponseEntity<FuncionarioDTO> obtenerPorId(@Parameter(description = "ID del funcionario") @PathVariable Long id) {
        autorizacionRecursosService.verificarFuncionarioConsultable(id);
        Funcionario funcionario = funcionarioService.obtenerFuncionarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario no encontrado con ID: " + id));
        return ResponseEntity.ok(FuncionarioDTO.from(funcionario));
    }

    @Operation(summary = "Listar funcionarios por entidad")
    @GetMapping("/entidad/{entidadId}")
    public ResponseEntity<List<FuncionarioDTO>> listarPorEntidad(@Parameter(description = "ID de la entidad") @PathVariable Long entidadId) {
        autorizacionRecursosService.verificarEntidadInstitucional(entidadId);
        List<FuncionarioDTO> funcionarios = funcionarioService.obtenerFuncionariosPorEntidad(entidadId)
                .stream()
                .map(FuncionarioDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(funcionarios);
    }

    @Operation(summary = "Registrar funcionario")
    @PostMapping
    public ResponseEntity<FuncionarioDTO> crear(@RequestBody Map<String, String> body) {
        String entidadIdStr = body.get("entidadId");
        if (entidadIdStr == null) {
            throw new IllegalArgumentException("El ID de la entidad es obligatorio");
        }

        Long entidadId = Long.valueOf(entidadIdStr);
        Entidad entidad = entidadService.findById(entidadId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + entidadId));

        Funcionario funcionario = new Funcionario();
        funcionario.setNombreCompleto(body.get("nombreCompleto"));
        funcionario.setCargo(body.get("cargo"));
        funcionario.setEmail(body.get("email"));
        funcionario.setTelefono(body.get("telefono"));
        funcionario.setEntidad(entidad);
        funcionario.setActivo(true);
        funcionario.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);

        String passwordValue = body.get("password");
        if (passwordValue == null || passwordValue.isBlank()) {
            passwordValue = "temp" + System.currentTimeMillis();
        }
        funcionario.setPassword(passwordEncoder.encode(passwordValue));

        funcionario = funcionarioService.guardarFuncionario(funcionario);

        return ResponseEntity.status(201).body(FuncionarioDTO.from(funcionario));
    }

    @Operation(summary = "Actualizar funcionario")
    @PutMapping("/{id}")
    public ResponseEntity<FuncionarioDTO> actualizar(@Parameter(description = "ID del funcionario") @PathVariable Long id, @RequestBody FuncionarioDTO funcionarioDTO) {
        autorizacionRecursosService.verificarFuncionarioEditable(id);
        Funcionario funcionario = funcionarioService.obtenerFuncionarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario no encontrado con ID: " + id));

        funcionario.setNombreCompleto(funcionarioDTO.nombreCompleto());
        funcionario.setCargo(funcionarioDTO.cargo());
        funcionario.setEmail(funcionarioDTO.email());
        funcionario.setTelefono(funcionarioDTO.telefono());

        if (funcionarioDTO.entidadId() != null) {
            autorizacionRecursosService.verificarEntidadInstitucional(funcionarioDTO.entidadId());
            Entidad entidad = entidadService.findById(funcionarioDTO.entidadId())
                    .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + funcionarioDTO.entidadId()));
            funcionario.setEntidad(entidad);
        }

        funcionario = funcionarioService.guardarFuncionario(funcionario);

        return ResponseEntity.ok(FuncionarioDTO.from(funcionario));
    }

    @Operation(summary = "Activar o desactivar funcionario")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<FuncionarioDTO> cambiarEstado(@Parameter(description = "ID del funcionario") @PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Funcionario funcionario = funcionarioService.obtenerFuncionarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario no encontrado con ID: " + id));

        Boolean activo = body.get("activo");
        funcionario = (Funcionario) usuarioService.cambiarEstado(id, activo);

        return ResponseEntity.ok(FuncionarioDTO.from(funcionario));
    }

    @Operation(summary = "Eliminar funcionario")
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@Parameter(description = "ID del funcionario") @PathVariable Long id) {
        funcionarioService.obtenerFuncionarioPorId(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario no encontrado con ID: " + id));

        funcionarioService.eliminarFuncionario(id);

        Map<String, Object> response = new HashMap<>();
        response.put("mensaje", "Funcionario eliminado correctamente");
        response.put("id", id);

        return ResponseEntity.ok(response);
    }
}

