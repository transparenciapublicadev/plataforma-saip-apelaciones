package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriUtils;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.AdmitirElevacionExcepcionalRequest;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.ComunicarOmisionElevacionRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionAnteEntidadRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionExternaRequest;
import pe.gob.saip.backend.model.dto.ElevacionApelacionTtaipDTO;
import pe.gob.saip.backend.model.dto.ElevarApelacionTtaipRequest;
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
    private final ElevacionApelacionTtaipService elevacionService;

    public ApelacionRestController(ApelacionService apelacionService,
                                    SolicitudService solicitudService,
                                    CiudadanoService ciudadanoService,
                                    ExpedienteTtaipService expedienteTtaipService,
                                    ElevacionApelacionTtaipService elevacionService) {
        this.apelacionService = apelacionService;
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.expedienteTtaipService = expedienteTtaipService;
        this.elevacionService = elevacionService;
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
        apelacion.setTipoOrigen(Apelacion.TipoOrigenApelacion.SAIP_INTERNA);
        apelacion.setCiudadano(ciudadano);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);

        apelacion = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);

        return ResponseEntity.status(201).body(ApelacionDTO.from(apelacion));
    }

    @Operation(
            summary = "Crear apelación externa",
            description = "Crea una apelación TTAIP para una SAIP tramitada fuera de la plataforma sin exigir solicitudId local")
    @PostMapping("/externa")
    public ResponseEntity<ApelacionDTO> crearExterna(@Valid @RequestBody CrearApelacionExternaRequest request) {
        Apelacion apelacion = apelacionService.crearExterna(request);
        expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);
        return ResponseEntity.status(201).body(ApelacionDTO.from(apelacion));
    }

    @Operation(
            summary = "Crear apelación presentada ante entidad",
            description = "Registra una apelación SAIP interna pendiente de elevación al TTAIP dentro de 2 días hábiles")
    @PostMapping("/ante-entidad")
    public ResponseEntity<ApelacionDTO> crearAnteEntidad(
            @Valid @RequestBody CrearApelacionAnteEntidadRequest request) {
        return ResponseEntity.status(201).body(
                ApelacionDTO.from(elevacionService.registrarPresentacionAnteEntidad(request)));
    }

    @Operation(summary = "Consultar elevación formal de una apelación")
    @GetMapping("/{id}/elevacion")
    public ResponseEntity<ElevacionApelacionTtaipDTO> obtenerElevacion(@PathVariable Long id) {
        return ResponseEntity.ok(ElevacionApelacionTtaipDTO.from(elevacionService.obtenerPorApelacion(id)));
    }

    @Operation(summary = "Listar apelaciones pendientes de elevación por entidad")
    @GetMapping("/entidad/{entidadId}/pendientes-elevacion")
    public ResponseEntity<List<ElevacionApelacionTtaipDTO>> listarPendientesElevacion(@PathVariable Long entidadId) {
        return ResponseEntity.ok(elevacionService.listarPendientesPorEntidad(entidadId)
                .stream()
                .map(ElevacionApelacionTtaipDTO::from)
                .toList());
    }

    @Operation(summary = "Elevar apelación desde entidad pública al TTAIP")
    @PostMapping("/{id}/elevacion/elevar")
    public ResponseEntity<ApelacionDTO> elevar(
            @PathVariable Long id,
            @Valid @RequestBody ElevarApelacionTtaipRequest request) {
        return ResponseEntity.ok(ApelacionDTO.from(elevacionService.elevar(id, request)));
    }

    @Operation(summary = "Procesar elevaciones vencidas no remitidas por la entidad")
    @PostMapping("/elevaciones/vencidas/procesar")
    public ResponseEntity<List<ElevacionApelacionTtaipDTO>> procesarElevacionesVencidas() {
        return ResponseEntity.ok(elevacionService.procesarVencidas()
                .stream()
                .map(ElevacionApelacionTtaipDTO::from)
                .toList());
    }

    @Operation(summary = "Comunicar omisión de elevación por parte de la entidad")
    @PostMapping("/{id}/elevacion/comunicacion-ciudadana")
    public ResponseEntity<ElevacionApelacionTtaipDTO> comunicarOmision(
            @PathVariable Long id,
            @Valid @RequestBody ComunicarOmisionElevacionRequest request) {
        return ResponseEntity.ok(ElevacionApelacionTtaipDTO.from(elevacionService.comunicarOmision(id, request)));
    }

    @Operation(summary = "Admitir excepcionalmente apelación por omisión acreditada de elevación")
    @PostMapping("/{id}/elevacion/admitir-excepcionalmente")
    public ResponseEntity<ApelacionDTO> admitirExcepcionalmente(
            @PathVariable Long id,
            @Valid @RequestBody AdmitirElevacionExcepcionalRequest request) {
        return ResponseEntity.ok(ApelacionDTO.from(elevacionService.admitirExcepcionalmente(id, request)));
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
            Apelacion.EstadoApelacion nuevoEstado;
            try {
                nuevoEstado = Apelacion.EstadoApelacion.valueOf(apelacionDTO.estado().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Estado no válido: " + apelacionDTO.estado());
            }
            validarCambioEstadoFueraDeElevacion(apelacion, nuevoEstado);
            apelacion.setEstado(nuevoEstado);
        }

        apelacion = apelacionService.save(apelacion);
        if (apelacion.getEstado() != Apelacion.EstadoApelacion.PENDIENTE_ELEVACION) {
            expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);
        }

        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    @Operation(summary = "Cambiar estado de apelación")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApelacionDTO> cambiarEstado(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody Map<String, String> body) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));

        String nuevoEstado = body.get("estado");
        Apelacion.EstadoApelacion estado;
        try {
            estado = Apelacion.EstadoApelacion.valueOf(nuevoEstado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + nuevoEstado);
        }
        validarCambioEstadoFueraDeElevacion(apelacion, estado);
        apelacion.setEstado(estado);

        apelacion = apelacionService.save(apelacion);
        if (apelacion.getEstado() != Apelacion.EstadoApelacion.PENDIENTE_ELEVACION) {
            expedienteTtaipService.obtenerOCrearParaApelacion(apelacion);
        }

        return ResponseEntity.ok(ApelacionDTO.from(apelacion));
    }

    private void validarCambioEstadoFueraDeElevacion(
            Apelacion apelacion,
            Apelacion.EstadoApelacion nuevoEstado) {
        if (apelacion.getEstado() == Apelacion.EstadoApelacion.PENDIENTE_ELEVACION
                && nuevoEstado != Apelacion.EstadoApelacion.PENDIENTE_ELEVACION) {
            throw new IllegalArgumentException(
                    "La apelación pendiente de elevación solo puede avanzar mediante el flujo formal de elevación");
        }
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
        stats.put("pendientes",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION));
        stats.put("pendientesElevacion",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION));
        stats.put("enCalificacion",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1));
        stats.put("enSubsanacion", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
        stats.put("resueltosFundado", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO));
        stats.put("resueltosInfundado", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO));
        stats.put("resueltosFundadoEnParte", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE));
        stats.put("resueltosInfundadoEnParte", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE));
        stats.put("resueltosImprocedente", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE));
        stats.put("resueltosEsteseALoResuelto", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO));
        stats.put("resueltosNulidadActo", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_NULIDAD_ACTO));
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

