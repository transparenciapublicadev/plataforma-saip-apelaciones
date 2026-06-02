package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.CiudadanoDTO;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.service.ApelacionService;
import pe.gob.saip.backend.service.AutorizacionRecursosService;
import pe.gob.saip.backend.service.CiudadanoService;
import pe.gob.saip.backend.service.SolicitudService;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ciudadanos")
@Tag(name = "Ciudadanos", description = "Gestión de ciudadanos solicitantes")
public class CiudadanoRestController {

    private final CiudadanoService ciudadanoService;
    private final SolicitudService solicitudService;
    private final ApelacionService apelacionService;
    private final PasswordEncoder passwordEncoder;
    private final AutorizacionRecursosService autorizacionRecursosService;

    public CiudadanoRestController(CiudadanoService ciudadanoService,
                                    SolicitudService solicitudService,
                                    ApelacionService apelacionService,
                                    PasswordEncoder passwordEncoder,
                                    AutorizacionRecursosService autorizacionRecursosService) {
        this.ciudadanoService = ciudadanoService;
        this.solicitudService = solicitudService;
        this.apelacionService = apelacionService;
        this.passwordEncoder = passwordEncoder;
        this.autorizacionRecursosService = autorizacionRecursosService;
    }

    @Operation(summary = "Listar todos los ciudadanos")
    @GetMapping
    public ResponseEntity<List<CiudadanoDTO>> listar() {
        List<CiudadanoDTO> ciudadanos = autorizacionRecursosService
                .filtrarCiudadanosAccesibles(ciudadanoService.obtenerTodosLosCiudadanos())
                .stream()
                .map(CiudadanoDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ciudadanos);
    }

    @Operation(summary = "Obtener ciudadano por ID")
    @GetMapping("/{id}")
    public ResponseEntity<CiudadanoDTO> obtenerPorId(@Parameter(description = "ID del ciudadano") @PathVariable Long id) {
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(id);
        Ciudadano ciudadano = ciudadanoService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + id));
        return ResponseEntity.ok(CiudadanoDTO.from(ciudadano));
    }

    @Operation(summary = "Buscar ciudadano por DNI")
    @GetMapping("/dni/{dni}")
    public ResponseEntity<CiudadanoDTO> obtenerPorDni(@Parameter(description = "DNI de 8 dígitos") @PathVariable String dni) {
        Ciudadano ciudadano = ciudadanoService.obtenerCiudadanoPorDni(dni)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con DNI: " + dni));
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(ciudadano.getId());
        return ResponseEntity.ok(CiudadanoDTO.from(ciudadano));
    }

    @Operation(summary = "Obtener ciudadano con estadísticas", description = "Incluye conteo de solicitudes, apelaciones y estados")
    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<CiudadanoDTO> obtenerConEstadisticas(@Parameter(description = "ID del ciudadano") @PathVariable Long id) {
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(id);
        Ciudadano ciudadano = ciudadanoService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + id));

        var solicitudes = solicitudService.findByCiudadanoId(id);
        long totalSolicitudes = solicitudes.size();
        long solicitudesEnProceso = solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado()))
                .count();
        long solicitudesRespondidas = solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                .count();
        long apelacionesRealizadas = apelacionService.countByCiudadanoId(id);

        return ResponseEntity.ok(new CiudadanoDTO(
                ciudadano.getId(), ciudadano.getDni(), ciudadano.getNombreCompleto(),
                ciudadano.getEmail(), ciudadano.getTelefono(), ciudadano.getDireccion(),
                ciudadano.getFechaRegistro() != null ? ciudadano.getFechaRegistro().toString() : null,
                ciudadano.getActivo(), totalSolicitudes, solicitudesEnProceso,
                solicitudesRespondidas, apelacionesRealizadas
        ));
    }

    @Operation(summary = "Registrar ciudadano")
    @PostMapping
    public ResponseEntity<CiudadanoDTO> crear(@RequestBody Map<String, String> body) {
        String dni = body.get("dni");
        if (ciudadanoService.obtenerCiudadanoPorDni(dni).isPresent()) {
            throw new IllegalArgumentException("Ya existe un ciudadano con el DNI: " + dni);
        }

        Ciudadano ciudadano = new Ciudadano();
        ciudadano.setDni(dni);
        ciudadano.setNombreCompleto(body.get("nombreCompleto"));
        ciudadano.setEmail(body.get("email"));
        ciudadano.setTelefono(body.get("telefono"));
        ciudadano.setDireccion(body.get("direccion"));
        ciudadano.setActivo(true);
        ciudadano.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);

        String passwordValue = body.get("password");
        if (passwordValue == null || passwordValue.isBlank()) {
            passwordValue = "temp" + System.currentTimeMillis();
        }
        ciudadano.setPassword(passwordEncoder.encode(passwordValue));

        ciudadano = ciudadanoService.guardarCiudadano(ciudadano);

        return ResponseEntity.status(201).body(CiudadanoDTO.from(ciudadano));
    }

    @Operation(summary = "Actualizar datos de ciudadano")
    @PutMapping("/{id}")
    public ResponseEntity<CiudadanoDTO> actualizar(@Parameter(description = "ID del ciudadano") @PathVariable Long id, @RequestBody CiudadanoDTO ciudadanoDTO) {
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(id);
        Ciudadano ciudadano = ciudadanoService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + id));

        ciudadano.setNombreCompleto(ciudadanoDTO.nombreCompleto());
        ciudadano.setEmail(ciudadanoDTO.email());
        ciudadano.setTelefono(ciudadanoDTO.telefono());
        ciudadano.setDireccion(ciudadanoDTO.direccion());

        ciudadano = ciudadanoService.guardarCiudadano(ciudadano);

        return ResponseEntity.ok(CiudadanoDTO.from(ciudadano));
    }

    @Operation(summary = "Activar o desactivar ciudadano")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<CiudadanoDTO> cambiarEstado(@Parameter(description = "ID del ciudadano") @PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        Ciudadano ciudadano = ciudadanoService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + id));

        Boolean activo = body.get("activo");
        ciudadano.setActivo(activo);

        ciudadano = ciudadanoService.guardarCiudadano(ciudadano);

        return ResponseEntity.ok(CiudadanoDTO.from(ciudadano));
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@PathVariable Long id) {
        ciudadanoService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + id));

        var solicitudes = solicitudService.findByCiudadanoId(id);
        if (!solicitudes.isEmpty()) {
            throw new IllegalArgumentException("No se puede eliminar el ciudadano. Tiene " + solicitudes.size() + " solicitudes asociadas.");
        }

        ciudadanoService.eliminarCiudadano(id);

        Map<String, Object> response = Map.of(
                "mensaje", "Ciudadano eliminado correctamente",
                "id", id
        );

        return ResponseEntity.ok(response);
    }
}

