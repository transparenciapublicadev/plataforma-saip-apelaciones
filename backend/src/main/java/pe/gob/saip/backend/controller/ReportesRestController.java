package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/reportes")
@Tag(name = "Reportes", description = "Reportes consolidados del sistema SAIP")
public class ReportesRestController {

    private final SolicitudService solicitudService;
    private final ApelacionService apelacionService;
    private final EntidadService entidadService;
    private final CiudadanoService ciudadanoService;
    private final FuncionarioService funcionarioService;

    public ReportesRestController(SolicitudService solicitudService,
                                   ApelacionService apelacionService,
                                   EntidadService entidadService,
                                   CiudadanoService ciudadanoService,
                                   FuncionarioService funcionarioService) {
        this.solicitudService = solicitudService;
        this.apelacionService = apelacionService;
        this.entidadService = entidadService;
        this.ciudadanoService = ciudadanoService;
        this.funcionarioService = funcionarioService;
    }

    @Operation(summary = "Reporte de solicitudes", description = "Filtrable por estado, entidad y rango de fechas")
    @GetMapping("/solicitudes")
    public ResponseEntity<Map<String, Object>> reporteSolicitudes(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) Long entidadId,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        Map<String, Object> reporte = new HashMap<>();
        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes();

        if (estado != null && !estado.isEmpty()) {
            solicitudes = solicitudes.stream()
                    .filter(s -> s.getEstado() != null && s.getEstado().name().equals(estado))
                    .collect(Collectors.toList());
        }

        if (entidadId != null) {
            solicitudes = solicitudes.stream()
                    .filter(s -> s.getEntidad() != null && s.getEntidad().getId().equals(entidadId))
                    .collect(Collectors.toList());
        }

        if (desde != null && !desde.isEmpty()) {
            LocalDateTime fechaDesde = LocalDateTime.parse(desde + "T00:00:00");
            solicitudes = solicitudes.stream()
                    .filter(s -> s.getFechaPresentacion() != null && s.getFechaPresentacion().isAfter(fechaDesde))
                    .collect(Collectors.toList());
        }

        if (hasta != null && !hasta.isEmpty()) {
            LocalDateTime fechaHasta = LocalDateTime.parse(hasta + "T23:59:59");
            solicitudes = solicitudes.stream()
                    .filter(s -> s.getFechaPresentacion() != null && s.getFechaPresentacion().isBefore(fechaHasta))
                    .collect(Collectors.toList());
        }

        reporte.put("fechaGeneracion", LocalDateTime.now().toString());
        reporte.put("totalRegistros", solicitudes.size());
        reporte.put("filtros", Map.of(
                "estado", estado != null ? estado : "todos",
                "entidadId", entidadId != null ? entidadId : "todas",
                "desde", desde != null ? desde : "sin límite",
                "hasta", hasta != null ? hasta : "sin límite"
        ));

        List<Map<String, Object>> datos = solicitudes.stream()
                .map(s -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", s.getId());
                    item.put("expediente", s.getExpediente());
                    item.put("asunto", s.getAsunto());
                    item.put("estado", s.getEstado() != null ? s.getEstado().name() : null);
                    item.put("fechaSolicitud", s.getFechaPresentacion() != null ? s.getFechaPresentacion().toString() : null);
                    item.put("entidad", s.getEntidad() != null ? s.getEntidad().getNombre() : null);
                    item.put("ciudadano", s.getCiudadano() != null ? s.getCiudadano().getNombreCompleto() : null);
                    item.put("tieneRespuesta", s.getRespuesta() != null);
                    return item;
                })
                .collect(Collectors.toList());

        reporte.put("datos", datos);

        return ResponseEntity.ok(reporte);
    }

    @Operation(summary = "Reporte de apelaciones", description = "Filtrable por estado y rango de fechas")
    @GetMapping("/apelaciones")
    public ResponseEntity<Map<String, Object>> reporteApelaciones(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String desde,
            @RequestParam(required = false) String hasta) {

        Map<String, Object> reporte = new HashMap<>();
        List<Apelacion> apelaciones = apelacionService.findAll();

        if (estado != null && !estado.isEmpty()) {
            apelaciones = apelaciones.stream()
                    .filter(a -> a.getEstado() != null && a.getEstado().name().equals(estado))
                    .collect(Collectors.toList());
        }

        if (desde != null && !desde.isEmpty()) {
            LocalDateTime fechaDesde = LocalDateTime.parse(desde + "T00:00:00");
            apelaciones = apelaciones.stream()
                    .filter(a -> a.getFechaApelacion() != null && a.getFechaApelacion().isAfter(fechaDesde))
                    .collect(Collectors.toList());
        }

        if (hasta != null && !hasta.isEmpty()) {
            LocalDateTime fechaHasta = LocalDateTime.parse(hasta + "T23:59:59");
            apelaciones = apelaciones.stream()
                    .filter(a -> a.getFechaApelacion() != null && a.getFechaApelacion().isBefore(fechaHasta))
                    .collect(Collectors.toList());
        }

        reporte.put("fechaGeneracion", LocalDateTime.now().toString());
        reporte.put("totalRegistros", apelaciones.size());
        reporte.put("filtros", Map.of(
                "estado", estado != null ? estado : "todos",
                "desde", desde != null ? desde : "sin límite",
                "hasta", hasta != null ? hasta : "sin límite"
        ));

        List<Map<String, Object>> datos = apelaciones.stream()
                .map(a -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", a.getId());
                    item.put("expediente", a.getExpediente());
                    item.put("estado", a.getEstado() != null ? a.getEstado().name() : null);
                    item.put("fechaApelacion", a.getFechaApelacion() != null ? a.getFechaApelacion().toString() : null);
                    item.put("solicitudExpediente", a.getSolicitud() != null ? a.getSolicitud().getExpediente() : null);
                    item.put("tipoOrigen", a.getTipoOrigenEfectivo().name());
                    item.put("numeroSolicitudExterna", a.getNumeroSolicitudExterna());
                    item.put("entidad", a.getEntidadNombreEfectivo());
                    item.put("ciudadano", a.getCiudadano() != null ? a.getCiudadano().getNombreCompleto() : null);
                    item.put("tieneResolucion", a.getResolucion() != null);
                    return item;
                })
                .collect(Collectors.toList());

        reporte.put("datos", datos);

        return ResponseEntity.ok(reporte);
    }

    @Operation(summary = "Reporte de entidades", description = "Incluye solicitudes pendientes y respondidas por entidad")
    @GetMapping("/entidades")
    public ResponseEntity<Map<String, Object>> reporteEntidades() {
        Map<String, Object> reporte = new HashMap<>();
        List<Entidad> entidades = entidadService.findAll();

        reporte.put("fechaGeneracion", LocalDateTime.now().toString());
        reporte.put("totalRegistros", entidades.size());

        List<Map<String, Object>> datos = entidades.stream()
                .map(e -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", e.getId());
                    item.put("nombre", e.getNombre());
                    item.put("acronimo", e.getAcronimo());
                    item.put("descripcion", e.getDescripcion());
                    item.put("activa", e.getActiva());

                    List<Solicitud> solicitudes = solicitudService.findByEntidadId(e.getId());
                    item.put("totalSolicitudes", solicitudes.size());
                    item.put("solicitudesPendientes", solicitudes.stream()
                            .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                                    || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())
                                    || Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado()))
                            .count());
                    item.put("solicitudesRespondidas", solicitudes.stream()
                            .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                            .count());

                    return item;
                })
                .collect(Collectors.toList());

        reporte.put("datos", datos);

        return ResponseEntity.ok(reporte);
    }

    @Operation(summary = "Reporte de funcionarios", description = "Filtrable por entidad, incluye respuestas emitidas")
    @GetMapping("/funcionarios")
    public ResponseEntity<Map<String, Object>> reporteFuncionarios(
            @RequestParam(required = false) Long entidadId) {

        Map<String, Object> reporte = new HashMap<>();
        List<Funcionario> funcionarios = funcionarioService.obtenerTodosLosFuncionarios();

        if (entidadId != null) {
            funcionarios = funcionarios.stream()
                    .filter(f -> f.getEntidad() != null && f.getEntidad().getId().equals(entidadId))
                    .collect(Collectors.toList());
        }

        reporte.put("fechaGeneracion", LocalDateTime.now().toString());
        reporte.put("totalRegistros", funcionarios.size());
        reporte.put("filtros", Map.of(
                "entidadId", entidadId != null ? entidadId : "todas"
        ));

        List<Map<String, Object>> datos = funcionarios.stream()
                .map(f -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", f.getId());
                    item.put("nombreCompleto", f.getNombreCompleto());
                    item.put("cargo", f.getCargo());
                    item.put("email", f.getEmail());
                    item.put("activo", f.getActivo());
                    item.put("entidad", f.getEntidad() != null ? f.getEntidad().getNombre() : null);
                    item.put("respuestasEmitidas", f.getRespuestas() != null ? f.getRespuestas().size() : 0);
                    return item;
                })
                .collect(Collectors.toList());

        reporte.put("datos", datos);

        return ResponseEntity.ok(reporte);
    }

    @Operation(summary = "Reporte de ciudadanos", description = "Incluye total de solicitudes y apelaciones por ciudadano")
    @GetMapping("/ciudadanos")
    public ResponseEntity<Map<String, Object>> reporteCiudadanos() {
        Map<String, Object> reporte = new HashMap<>();
        List<Ciudadano> ciudadanos = ciudadanoService.obtenerTodosLosCiudadanos();

        reporte.put("fechaGeneracion", LocalDateTime.now().toString());
        reporte.put("totalRegistros", ciudadanos.size());

        List<Map<String, Object>> datos = ciudadanos.stream()
                .map(c -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", c.getId());
                    item.put("nombreCompleto", c.getNombreCompleto());
                    item.put("dni", c.getDni());
                    item.put("email", c.getEmail());
                    item.put("activo", c.getActivo());
                    item.put("fechaRegistro", c.getFechaRegistro() != null ? c.getFechaRegistro().toString() : null);
                    item.put("totalSolicitudes", c.getSolicitudes() != null ? c.getSolicitudes().size() : 0);
                    item.put("totalApelaciones", c.getApelaciones() != null ? c.getApelaciones().size() : 0);
                    return item;
                })
                .collect(Collectors.toList());

        reporte.put("datos", datos);

        return ResponseEntity.ok(reporte);
    }

    @Operation(summary = "Resumen ejecutivo", description = "Vista consolidada del sistema con entidades más activas")
    @GetMapping("/resumen-ejecutivo")
    public ResponseEntity<Map<String, Object>> resumenEjecutivo() {
        Map<String, Object> resumen = new HashMap<>();

        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes();
        List<Apelacion> apelaciones = apelacionService.findAll();
        List<Entidad> entidades = entidadService.findAll();

        resumen.put("fechaGeneracion", LocalDateTime.now().toString());

        resumen.put("solicitudes", Map.of(
                "total", solicitudes.size(),
                "pendientes", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado())).count(),
                "respondidas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado())).count(),
                "denegadas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.DENEGADA.equals(s.getEstado())).count(),
                "vencidas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.VENCIDA.equals(s.getEstado())).count()
        ));

        resumen.put("apelaciones", Map.of(
                "total", apelaciones.size(),
                "pendientes", apelaciones.stream().filter(a ->
                        Apelacion.EstadoApelacion.PENDIENTE_ELEVACION.equals(a.getEstado()) ||
                        Apelacion.EstadoApelacion.EN_CALIFICACION_1.equals(a.getEstado())).count(),
                "enProceso", apelaciones.stream().filter(a ->
                        Apelacion.EstadoApelacion.EN_RESOLUCION.equals(a.getEstado()) ||
                        Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION.equals(a.getEstado()) ||
                        Apelacion.EstadoApelacion.EN_CALIFICACION_2.equals(a.getEstado()) ||
                        Apelacion.EstadoApelacion.EN_SUBSANACION.equals(a.getEstado())).count(),
                "resueltas", apelaciones.stream().filter(a -> a.isResuelta()).count()
        ));

        List<Map<String, Object>> entidadesMasActivas = entidades.stream()
                .map(e -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("nombre", e.getNombre());
                    item.put("solicitudes", solicitudService.findByEntidadId(e.getId()).size());
                    return item;
                })
                .sorted((a, b) -> Integer.compare((int) b.get("solicitudes"), (int) a.get("solicitudes")))
                .limit(5)
                .collect(Collectors.toList());

        resumen.put("entidadesMasActivas", entidadesMasActivas);

        resumen.put("usuarios", Map.of(
                "ciudadanos", ciudadanoService.obtenerTodosLosCiudadanos().size(),
                "funcionarios", funcionarioService.obtenerTodosLosFuncionarios().size(),
                "entidades", entidades.size()
        ));

        return ResponseEntity.ok(resumen);
    }
}
