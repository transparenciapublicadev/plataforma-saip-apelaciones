package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriUtils;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/apelaciones")
@Tag(name = "Apelaciones TTAIP", description = "Gestión de apelaciones ante el Tribunal de Transparencia")
public class ApelacionRestController {

    private final ApelacionService apelacionService;
    private final SolicitudService solicitudService;
    private final CiudadanoService ciudadanoService;
    private final ExpedienteTtaipService expedienteTtaipService;

    public ApelacionRestController(ApelacionService apelacionService,
                                    SolicitudService solicitudService,
                                    CiudadanoService ciudadanoService,
                                    ExpedienteTtaipService expedienteTtaipService) {
        this.apelacionService = apelacionService;
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.expedienteTtaipService = expedienteTtaipService;
    }

    @Operation(summary = "Listar todas las apelaciones")
    @GetMapping
    public ResponseEntity<List<ApelacionDTO>> listar() {
        List<ApelacionDTO> apelaciones = apelacionService.findAll()
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Obtener apelación por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApelacionDTO> obtenerPorId(@Parameter(description = "ID de la apelación") @PathVariable Long id) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));
        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Obtener apelación por expediente TTAIP", description = "Formato: NNNNN-AAAA-JUS/TTAIP")
    @GetMapping("/expediente")
    public ResponseEntity<ApelacionDTO> obtenerPorExpedienteQuery(@RequestParam("numero") String expediente) {
        return ResponseEntity.ok(ApelacionDTO.from(obtenerApelacionPorExpediente(expediente)));
    }

    @Operation(summary = "Obtener apelación por expediente TTAIP", description = "Formato: NNNNN-AAAA-JUS/TTAIP")
    @GetMapping({"/expediente/{expediente}", "/expediente/**"})
    public ResponseEntity<ApelacionDTO> obtenerPorExpediente(
            @Parameter(description = "Número de expediente TTAIP") @PathVariable(required = false) String expediente,
            HttpServletRequest request) {
        String expedienteResuelto = resolverExpediente(expediente, request);
        return ResponseEntity.ok(ApelacionDTO.from(obtenerApelacionPorExpediente(expedienteResuelto)));
    }

    private Apelacion obtenerApelacionPorExpediente(String expediente) {
        if (expediente == null || expediente.trim().isEmpty()) {
            throw new IllegalArgumentException("El expediente es obligatorio");
        }

        String expedienteNormalizado = expediente.trim();
        return apelacionService.findByExpediente(expedienteNormalizado)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con expediente: " + expedienteNormalizado));
    }

    private String resolverExpediente(String expediente, HttpServletRequest request) {
        if (expediente != null && !expediente.trim().isEmpty()) {
            return expediente.trim();
        }

        final String prefix = "/api/apelaciones/expediente/";
        String requestUri = request.getRequestURI();
        int start = requestUri.indexOf(prefix);
        if (start < 0) {
            return expediente;
        }

        String expedienteEnRuta = requestUri.substring(start + prefix.length());
        return UriUtils.decode(expedienteEnRuta, StandardCharsets.UTF_8);
    }

    @Operation(summary = "Listar apelaciones por estado")
    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<ApelacionDTO>> listarPorEstado(@Parameter(description = "Estado de la apelación") @PathVariable String estado) {
        Apelacion.EstadoApelacion estadoEnum;
        try {
            estadoEnum = Apelacion.EstadoApelacion.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + estado);
        }
        List<ApelacionDTO> apelaciones = apelacionService.obtenerApelacionesPorEstado(estadoEnum)
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Listar apelaciones por ciudadano")
    @GetMapping("/ciudadano/{ciudadanoId}")
    public ResponseEntity<List<ApelacionDTO>> listarPorCiudadano(@Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId) {
        List<ApelacionDTO> apelaciones = apelacionService.findByCiudadanoId(ciudadanoId)
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Crear apelación", description = "Crea apelación ante el TTAIP vinculada a una solicitud SAIP y al ciudadano solicitante")
    @PostMapping
    public ResponseEntity<ApelacionDTO> crear(@RequestBody ApelacionDTO apelacionDTO) {
        if (apelacionDTO.solicitudId() == null) {
            throw new IllegalArgumentException("El ID de la solicitud es obligatorio");
        }
        if (apelacionDTO.ciudadanoId() == null) {
            throw new IllegalArgumentException("El ID del ciudadano es obligatorio");
        }

        Solicitud solicitud = solicitudService.findById(apelacionDTO.solicitudId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + apelacionDTO.solicitudId()));

        if (solicitud.getApelacion() != null) {
            throw new IllegalArgumentException("La solicitud ya tiene una apelación asociada");
        }

        Ciudadano ciudadano = ciudadanoService.findById(apelacionDTO.ciudadanoId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + apelacionDTO.ciudadanoId()));

        Apelacion apelacion = new Apelacion();
        apelacion.setFundamentos(apelacionDTO.fundamentos());
        apelacion.setSolicitud(solicitud);
        apelacion.setCiudadano(ciudadano);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);

        apelacion = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);

        return ResponseEntity.status(201).body(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Actualizar apelación")
    @PutMapping("/{id}")
    public ResponseEntity<ApelacionDTO> actualizar(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody ApelacionDTO apelacionDTO) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));

        if (apelacionDTO.fundamentos() != null) {
            apelacion.setFundamentos(apelacionDTO.fundamentos());
        }

        if (apelacionDTO.estado() != null) {
            try {
                apelacion.setEstado(Apelacion.EstadoApelacion.valueOf(apelacionDTO.estado().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Estado no válido: " + apelacionDTO.estado());
            }
        }

        apelacion = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);

        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Cambiar estado de apelación")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApelacionDTO> cambiarEstado(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody Map<String, String> body) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));

        String nuevoEstado = body.get("estado");
        try {
            apelacion.setEstado(Apelacion.EstadoApelacion.valueOf(nuevoEstado.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + nuevoEstado);
        }

        apelacion = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);

        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Presentar subsanación", description = "Presenta fundamentos adicionales dentro del plazo de 2 días hábiles")
    @PostMapping("/{id}/subsanacion")
    public ResponseEntity<ApelacionDTO> subsanar(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody Map<String, String> body) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));

        if (!Apelacion.EstadoApelacion.EN_SUBSANACION.equals(apelacion.getEstado())) {
            throw new IllegalArgumentException("La apelación no está en estado de espera de subsanación");
        }

        String fundamentosAdicionales = body.get("fundamentosAdicionales");
        if (fundamentosAdicionales == null || fundamentosAdicionales.trim().isEmpty()) {
            throw new IllegalArgumentException("Los fundamentos adicionales son obligatorios");
        }

        String fundamentosActuales = apelacion.getFundamentos() != null ? apelacion.getFundamentos() : "";
        apelacion.setFundamentos(fundamentosActuales + "\n\n--- SUBSANACIÓN ---\n" + fundamentosAdicionales);

        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2);

        apelacion = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);

        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Estadísticas de apelaciones")
    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticas() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", apelacionService.count());
        stats.put("pendientes", 0L);
        stats.put("enCalificacion",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION));
        stats.put("enSubsanacion", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
        stats.put("resueltosFundado", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO));
        stats.put("resueltosInfundado", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO));
        stats.put("resueltosFundadoEnParte", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE));
        stats.put("resueltosInfundadoEnParte", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE));
        stats.put("resueltosImprocedente", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE));
        stats.put("tenerPorNoPresentado", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO));
        stats.put("conclusionSustraccion", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA));
        stats.put("conclusionDesistimiento", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.CONCLUSION_DESISTIMIENTO));

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Eliminar apelación")
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@Parameter(description = "ID de la apelación") @PathVariable Long id) {
        apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));
        apelacionService.eliminarApelacion(id);

        Map<String, Object> response = new HashMap<>();
        response.put("mensaje", "Apelación eliminada correctamente");
        response.put("id", id);

        return ResponseEntity.ok(response);
    }
}

