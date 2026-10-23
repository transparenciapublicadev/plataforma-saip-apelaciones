package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriUtils;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.AdmitirElevacionExcepcionalRequest;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.ApelacionResumenDTO;
import pe.gob.saip.backend.model.dto.ComunicarOmisionElevacionRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionAnteEntidadRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionExternaRequest;
import pe.gob.saip.backend.model.dto.ElevacionApelacionTtaipDTO;
import pe.gob.saip.backend.model.dto.ElevarApelacionTtaipRequest;
import pe.gob.saip.backend.model.dto.PaginaDTO;
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
    private final AutorizacionRecursosService autorizacionRecursosService;
    private final SubsanacionTtaipService subsanacionTtaipService;
    private final TransicionesApelacionTtaipService transiciones;

    public ApelacionRestController(ApelacionService apelacionService,
                                    SolicitudService solicitudService,
                                    CiudadanoService ciudadanoService,
                                    ExpedienteTtaipService expedienteTtaipService,
                                    ElevacionApelacionTtaipService elevacionService,
                                    AutorizacionRecursosService autorizacionRecursosService,
                                    SubsanacionTtaipService subsanacionTtaipService,
                                    TransicionesApelacionTtaipService transiciones) {
        this.apelacionService = apelacionService;
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.expedienteTtaipService = expedienteTtaipService;
        this.elevacionService = elevacionService;
        this.autorizacionRecursosService = autorizacionRecursosService;
        this.subsanacionTtaipService = subsanacionTtaipService;
        this.transiciones = transiciones;
    }

    @Operation(summary = "Listar todas las apelaciones")
    @GetMapping
    public ResponseEntity<List<ApelacionDTO>> listar() {
        List<ApelacionDTO> apelaciones = autorizacionRecursosService
                .filtrarApelacionesAccesibles(apelacionService.findAll())
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Listar apelaciones TTAIP con paginación y DTO liviano")
    @GetMapping("/paginadas")
    public ResponseEntity<PaginaDTO<ApelacionResumenDTO>> listarPaginadas(
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        return ResponseEntity.ok(PaginaDTO.from(
                apelacionService.obtenerPagina(crearPaginacion(pagina, tamano)),
                ApelacionResumenDTO::from));
    }

    @Operation(summary = "Obtener apelación por ID")
    @GetMapping("/{id}")
    public ResponseEntity<ApelacionDTO> obtenerPorId(@Parameter(description = "ID de la apelación") @PathVariable Long id) {
        Apelacion apelacion = apelacionService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + id));
        autorizacionRecursosService.verificarApelacionAccesible(apelacion);
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
        Apelacion apelacion = apelacionService.findByExpediente(expedienteNormalizado)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con expediente: " + expedienteNormalizado));
        autorizacionRecursosService.verificarApelacionAccesible(apelacion);
        return apelacion;
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
        List<ApelacionDTO> apelaciones = autorizacionRecursosService
                .filtrarApelacionesAccesibles(apelacionService.obtenerApelacionesPorEstado(estadoEnum))
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Listar apelaciones por ciudadano")
    @GetMapping("/ciudadano/{ciudadanoId}")
    public ResponseEntity<List<ApelacionDTO>> listarPorCiudadano(@Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId) {
        autorizacionRecursosService.verificarCiudadanoActualOPrivilegiado(ciudadanoId);
        List<ApelacionDTO> apelaciones = apelacionService.findByCiudadanoId(ciudadanoId)
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(apelaciones);
    }

    @Operation(summary = "Listar apelaciones por estado con paginación y DTO liviano")
    @GetMapping("/estado/{estado}/paginadas")
    public ResponseEntity<PaginaDTO<ApelacionResumenDTO>> listarPaginadasPorEstado(
            @Parameter(description = "Estado de la apelación") @PathVariable String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        Apelacion.EstadoApelacion estadoEnum;
        try {
            estadoEnum = Apelacion.EstadoApelacion.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + estado);
        }
        return ResponseEntity.ok(PaginaDTO.from(
                apelacionService.obtenerPaginaPorEstado(estadoEnum, crearPaginacion(pagina, tamano)),
                ApelacionResumenDTO::from));
    }

    @Operation(summary = "Listar apelaciones TTAIP de un ciudadano con paginación y DTO liviano")
    @GetMapping("/ciudadano/{ciudadanoId}/paginadas")
    public ResponseEntity<PaginaDTO<ApelacionResumenDTO>> listarPaginadasPorCiudadano(
            @Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        autorizacionRecursosService.verificarCiudadanoActualOPrivilegiado(ciudadanoId);
        return ResponseEntity.ok(PaginaDTO.from(
                apelacionService.obtenerPaginaPorCiudadano(ciudadanoId, crearPaginacion(pagina, tamano)),
                ApelacionResumenDTO::from));
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
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(apelacionDTO.ciudadanoId());
        autorizacionRecursosService.verificarSolicitudAccesible(apelacionDTO.solicitudId());

        Solicitud solicitud = solicitudService.findById(apelacionDTO.solicitudId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + apelacionDTO.solicitudId()));
        if (solicitud.getCiudadano() == null || !solicitud.getCiudadano().getId().equals(apelacionDTO.ciudadanoId())) {
            throw new IllegalArgumentException("La solicitud SAIP no corresponde al ciudadano recurrente");
        }

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
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(request.ciudadanoId());
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
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(request.ciudadanoId());
        autorizacionRecursosService.verificarSolicitudAccesible(request.solicitudId());
        return ResponseEntity.status(201).body(
                ApelacionDTO.from(elevacionService.registrarPresentacionAnteEntidad(request)));
    }

    @Operation(summary = "Consultar elevación formal de una apelación")
    @GetMapping("/{id}/elevacion")
    public ResponseEntity<ElevacionApelacionTtaipDTO> obtenerElevacion(@PathVariable Long id) {
        autorizacionRecursosService.verificarApelacionAccesible(id);
        return ResponseEntity.ok(ElevacionApelacionTtaipDTO.from(elevacionService.obtenerPorApelacion(id)));
    }

    @Operation(summary = "Listar apelaciones pendientes de elevación por entidad")
    @GetMapping("/entidad/{entidadId}/pendientes-elevacion")
    public ResponseEntity<List<ElevacionApelacionTtaipDTO>> listarPendientesElevacion(@PathVariable Long entidadId) {
        autorizacionRecursosService.verificarEntidadInstitucional(entidadId);
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
        autorizacionRecursosService.verificarElevacionInstitucional(id);
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
        autorizacionRecursosService.verificarApelacionCiudadanaOAdministrador(id);
        return ResponseEntity.ok(ElevacionApelacionTtaipDTO.from(elevacionService.comunicarOmision(id, request)));
    }

    @Operation(summary = "Admitir excepcionalmente apelación por omisión acreditada de elevación")
    @PostMapping("/{id}/elevacion/admitir-excepcionalmente")
    public ResponseEntity<ApelacionDTO> admitirExcepcionalmente(
            @PathVariable Long id,
            @Valid @RequestBody AdmitirElevacionExcepcionalRequest request) {
        return ResponseEntity.ok(ApelacionDTO.from(elevacionService.admitirExcepcionalmente(id, request)));
    }

    @Operation(summary = "Actualizar apelación", description = "Actualiza datos sin ejecutar transiciones. Un estado distinto del persistido requiere su comando específico y produce 409.")
    @ApiResponses({
        @ApiResponse(responseCode="200", description="Datos persistidos", content=@Content(schema=@Schema(implementation=ApelacionDTO.class))),
        @ApiResponse(responseCode="409", description="La transición requiere una actuación específica", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PutMapping("/{id}")
    public ResponseEntity<ApelacionDTO> actualizar(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody ApelacionDTO apelacionDTO) {
        return ResponseEntity.ok(transiciones.actualizarDatos(id, apelacionDTO.estado(), apelacionDTO.fundamentos()));
    }

    @Operation(summary = "Cambiar estado de apelación", description = "Ruta conservada por compatibilidad: solo admite repetir el estado actual. Para avanzar o cerrar se requiere el comando específico; cualquier cambio genérico produce 409.")
    @ApiResponses({
        @ApiResponse(responseCode="200", description="Estado actual sin nueva actuación", content=@Content(schema=@Schema(implementation=ApelacionDTO.class))),
        @ApiResponse(responseCode="409", description="La transición requiere una actuación específica", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApelacionDTO> cambiarEstado(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody Map<String, String> body) {
        String nuevoEstado = body.get("estado");
        if (nuevoEstado == null || nuevoEstado.isBlank()) {
            throw new IllegalArgumentException("El estado es obligatorio");
        }
        return ResponseEntity.ok(transiciones.actualizarDatos(id, nuevoEstado, null));
    }

    @Operation(summary = "Presentar subsanación", description = "Presenta fundamentos adicionales dentro del plazo de 2 días hábiles")
    @PostMapping("/{id}/subsanacion")
    public ResponseEntity<ApelacionDTO> subsanar(@Parameter(description = "ID de la apelación") @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(subsanacionTtaipService.registrarLegacy(id, body.get("fundamentosAdicionales")));
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

    private Pageable crearPaginacion(int pagina, int tamano) {
        if (pagina < 0) {
            throw new IllegalArgumentException("El número de página no puede ser negativo");
        }
        if (tamano < 1 || tamano > 100) {
            throw new IllegalArgumentException("El tamaño de página debe estar entre 1 y 100");
        }
        return PageRequest.of(pagina, tamano, Sort.by(Sort.Direction.DESC, "fechaApelacion"));
    }
}

