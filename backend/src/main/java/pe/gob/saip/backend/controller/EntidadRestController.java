package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.EntidadDTO;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.service.AutorizacionRecursosService;
import pe.gob.saip.backend.service.EntidadService;
import pe.gob.saip.backend.service.SolicitudService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/entidades")
@Tag(name = "Entidades Públicas", description = "Gestión de entidades públicas del sistema")
public class EntidadRestController {

    private static final Set<String> ESTADOS_VALIDOS = Set.of("Activa", "Inactiva");

    private final EntidadService entidadService;
    private final SolicitudService solicitudService;
    private final AutorizacionRecursosService autorizacionRecursosService;

    public EntidadRestController(EntidadService entidadService,
                                 SolicitudService solicitudService,
                                 AutorizacionRecursosService autorizacionRecursosService) {
        this.entidadService = entidadService;
        this.solicitudService = solicitudService;
        this.autorizacionRecursosService = autorizacionRecursosService;
    }

    @Operation(summary = "Listar todas las entidades públicas")
    @GetMapping
    public ResponseEntity<List<EntidadDTO>> listar() {
        List<EntidadDTO> entidades = entidadService.findAll()
                .stream()
                .map(EntidadDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entidades);
    }

    @Operation(summary = "Listar entidades activas")
    @GetMapping("/activas")
    public ResponseEntity<List<EntidadDTO>> listarActivas() {
        List<EntidadDTO> entidades = entidadService.findActivas().stream()
                .map(EntidadDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entidades);
    }

    @Operation(summary = "Obtener entidad por ID")
    @GetMapping("/{id}")
    public ResponseEntity<EntidadDTO> obtenerPorId(@Parameter(description = "ID de la entidad") @PathVariable Long id) {
        Entidad entidad = entidadService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + id));
        return ResponseEntity.ok(EntidadDTO.from(entidad));
    }

    @Operation(summary = "Obtener entidad con estadísticas", description = "Incluye tasa de cumplimiento, solicitudes asignadas/pendientes/respondidas/vencidas")
    @GetMapping("/{id}/estadisticas")
    public ResponseEntity<EntidadDTO> obtenerConEstadisticas(@Parameter(description = "ID de la entidad") @PathVariable Long id) {
        autorizacionRecursosService.verificarEntidadInstitucional(id);
        Entidad entidad = entidadService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + id));

        long solicitudesAsignadas = solicitudService.countByEntidadId(id);
        long pendientes = solicitudService.countByEntidadIdAndEstado(id, Solicitud.EstadoSolicitud.RECEPCIONADA.name());
        long respondidas = solicitudService.countByEntidadIdAndEstado(id, Solicitud.EstadoSolicitud.RESPONDIDA.name());
        long vencidas = solicitudService.countByEntidadIdAndEstado(id, Solicitud.EstadoSolicitud.VENCIDA.name());
        int tasaCumplimiento = solicitudesAsignadas > 0 ? (int) ((respondidas * 100) / solicitudesAsignadas) : 0;

        return ResponseEntity.ok(new EntidadDTO(
                entidad.getId(), entidad.getNombre(), entidad.getAcronimo(),
                entidad.getDescripcion(), entidad.getDireccion(), entidad.getTelefono(),
                entidad.getEmail(), entidad.getEstado(), entidad.getActiva(),
                entidad.getFechaRegistro() != null ? entidad.getFechaRegistro().toString() : null,
                solicitudesAsignadas, pendientes, respondidas, vencidas, tasaCumplimiento
        ));
    }

    @Operation(summary = "Buscar entidades por nombre")
    @GetMapping("/buscar")
    public ResponseEntity<List<EntidadDTO>> buscarPorNombre(@Parameter(description = "Texto de búsqueda") @RequestParam String nombre) {
        List<EntidadDTO> entidades = entidadService.buscarPorNombre(nombre).stream()
                .map(EntidadDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(entidades);
    }

    @Operation(summary = "Registrar entidad pública")
    @PostMapping
    public ResponseEntity<EntidadDTO> crear(@RequestBody EntidadDTO entidadDTO) {
        String nombre = sanitizeRequiredPlainText(entidadDTO.nombre(), "nombre", 200);
        String acronimo = sanitizeRequiredPlainText(entidadDTO.acronimo(), "acronimo", 20).toUpperCase();

        if (entidadService.obtenerEntidadPorAcronimo(acronimo).isPresent()) {
            throw new IllegalArgumentException("Ya existe una entidad con el acrónimo: " + acronimo);
        }

        Entidad entidad = new Entidad();
        entidad.setNombre(nombre);
        entidad.setAcronimo(acronimo);
        entidad.setDescripcion(sanitizeOptionalPlainText(entidadDTO.descripcion(), "descripcion", 500));
        entidad.setDireccion(sanitizeOptionalPlainText(entidadDTO.direccion(), "direccion", 300));
        entidad.setTelefono(sanitizeOptionalPlainText(entidadDTO.telefono(), "telefono", 20));
        entidad.setEmail(sanitizeOptionalPlainText(entidadDTO.email(), "email", 100));
        entidad.setEstado("Activa");
        entidad.setActiva(true);
        entidad.setFechaRegistro(LocalDateTime.now());

        entidadService.save(entidad);

        return ResponseEntity.status(201).body(EntidadDTO.from(entidad));
    }

    @Operation(summary = "Actualizar entidad pública")
    @PutMapping("/{id}")
    public ResponseEntity<EntidadDTO> actualizar(@Parameter(description = "ID de la entidad") @PathVariable Long id, @RequestBody EntidadDTO entidadDTO) {
        Entidad entidad = entidadService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + id));

        if (entidadDTO.acronimo() != null) {
            String nuevoAcronimo = sanitizeRequiredPlainText(entidadDTO.acronimo(), "acronimo", 20).toUpperCase();
            if (!nuevoAcronimo.equalsIgnoreCase(entidad.getAcronimo())) {
                entidadService.obtenerEntidadPorAcronimo(nuevoAcronimo)
                        .filter(existente -> !existente.getId().equals(id))
                        .ifPresent(existente -> {
                            throw new IllegalArgumentException("Ya existe una entidad con el acrónimo: " + nuevoAcronimo);
                        });
            }
            entidad.setAcronimo(nuevoAcronimo);
        }

        if (entidadDTO.nombre() != null) {
            entidad.setNombre(sanitizeRequiredPlainText(entidadDTO.nombre(), "nombre", 200));
        }
        if (entidadDTO.descripcion() != null) {
            entidad.setDescripcion(sanitizeOptionalPlainText(entidadDTO.descripcion(), "descripcion", 500));
        }
        if (entidadDTO.direccion() != null) {
            entidad.setDireccion(sanitizeOptionalPlainText(entidadDTO.direccion(), "direccion", 300));
        }
        if (entidadDTO.telefono() != null) {
            entidad.setTelefono(sanitizeOptionalPlainText(entidadDTO.telefono(), "telefono", 20));
        }
        if (entidadDTO.email() != null) {
            entidad.setEmail(sanitizeOptionalPlainText(entidadDTO.email(), "email", 100));
        }

        if (entidadDTO.estado() != null) {
            String estado = sanitizeRequiredPlainText(entidadDTO.estado(), "estado", 20);
            if (!ESTADOS_VALIDOS.contains(estado)) {
                throw new IllegalArgumentException("Estado no válido. Use Activa o Inactiva.");
            }
            entidad.setEstado(estado);
            entidad.setActiva("Activa".equals(estado));
        }

        entidadService.save(entidad);

        return ResponseEntity.ok(EntidadDTO.from(entidad));
    }

    @Operation(summary = "Cambiar estado de entidad")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<EntidadDTO> cambiarEstado(@Parameter(description = "ID de la entidad") @PathVariable Long id, @RequestBody Map<String, String> body) {
        Entidad entidad = entidadService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + id));

        String nuevoEstado = sanitizeRequiredPlainText(body.get("estado"), "estado", 20);
        if (!ESTADOS_VALIDOS.contains(nuevoEstado)) {
            throw new IllegalArgumentException("Estado no válido. Use Activa o Inactiva.");
        }

        entidad.setEstado(nuevoEstado);
        entidad.setActiva("Activa".equals(nuevoEstado));

        entidadService.save(entidad);

        return ResponseEntity.ok(EntidadDTO.from(entidad));
    }

    @Operation(summary = "Eliminar entidad", description = "Solo si no tiene solicitudes asociadas")
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@Parameter(description = "ID de la entidad") @PathVariable Long id) {
        entidadService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + id));

        long solicitudesAsociadas = solicitudService.countByEntidadId(id);
        if (solicitudesAsociadas > 0) {
            throw new IllegalArgumentException("No se puede eliminar la entidad. Tiene " + solicitudesAsociadas + " solicitudes asociadas.");
        }

        entidadService.deleteById(id);

        Map<String, Object> response = new HashMap<>();
        response.put("mensaje", "Entidad eliminada correctamente");
        response.put("id", id);

        return ResponseEntity.ok(response);
    }

    private String sanitizeRequiredPlainText(String value, String fieldName, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("El campo " + fieldName + " es obligatorio.");
        }
        return sanitizeOptionalPlainText(value, fieldName, maxLength);
    }

    private String sanitizeOptionalPlainText(String value, String fieldName, int maxLength) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException("El campo " + fieldName + " excede el tamaño máximo de " + maxLength + " caracteres.");
        }
        if (normalized.contains("<") || normalized.contains(">")) {
            throw new IllegalArgumentException("El campo " + fieldName + " contiene caracteres no permitidos.");
        }
        return normalized;
    }
}
