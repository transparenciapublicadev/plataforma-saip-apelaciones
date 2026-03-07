package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/estadisticas")
@Tag(name = "Estadísticas", description = "Indicadores y métricas del sistema SAIP")
public class EstadisticasRestController {

    private final SolicitudService solicitudService;
    private final ApelacionService apelacionService;
    private final EntidadService entidadService;
    private final CiudadanoService ciudadanoService;
    private final FuncionarioService funcionarioService;

    public EstadisticasRestController(SolicitudService solicitudService,
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

    @Operation(summary = "Estadísticas generales del sistema", description = "Totales de solicitudes, apelaciones, entidades, ciudadanos y funcionarios")
    @GetMapping("/general")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticasGenerales() {
        Map<String, Object> stats = new HashMap<>();

        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes();
        stats.put("totalSolicitudes", solicitudes.size());
        stats.put("solicitudesPendientes", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado()))
                .count());
        stats.put("solicitudesRespondidas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                .count());
        stats.put("solicitudesDenegadas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.DENEGADA.equals(s.getEstado()))
                .count());
        stats.put("solicitudesVencidas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.VENCIDA.equals(s.getEstado()))
                .count());

        List<Apelacion> apelaciones = apelacionService.findAll();
        stats.put("totalApelaciones", apelaciones.size());
        stats.put("apelacionesPendientes", apelaciones.stream()
                .filter(a -> Apelacion.EstadoApelacion.PENDIENTE.equals(a.getEstado()) ||
                           Apelacion.EstadoApelacion.EN_CALIFICACION.equals(a.getEstado()))
                .count());
        stats.put("apelacionesResueltas", apelaciones.stream()
                .filter(a -> a.isResuelta())
                .count());

        stats.put("totalEntidades", entidadService.findAll().size());
        stats.put("totalCiudadanos", ciudadanoService.obtenerTodosLosCiudadanos().size());
        stats.put("totalFuncionarios", funcionarioService.obtenerTodosLosFuncionarios().size());

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Estadísticas por período", description = "Filtrar por semana, mes o año")
    @GetMapping("/periodo")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticasPorPeriodo(
            @Parameter(description = "Período: semana, mes, año") @RequestParam(defaultValue = "mes") String periodo) {

        Map<String, Object> stats = new HashMap<>();
        LocalDateTime ahora = LocalDateTime.now();
        LocalDateTime inicio;

        switch (periodo.toLowerCase()) {
            case "semana":
                inicio = ahora.minus(7, ChronoUnit.DAYS);
                break;
            case "año":
            case "anio":
                inicio = ahora.withDayOfYear(1).withHour(0).withMinute(0).withSecond(0);
                break;
            case "mes":
            default:
                inicio = ahora.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);
                break;
        }

        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes().stream()
                .filter(s -> s.getFechaPresentacion() != null && s.getFechaPresentacion().isAfter(inicio))
                .collect(Collectors.toList());

        stats.put("periodo", periodo);
        stats.put("desde", inicio.toString());
        stats.put("hasta", ahora.toString());
        stats.put("nuevasSolicitudes", solicitudes.size());
        stats.put("solicitudesRespondidas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                .count());

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Estadísticas por entidad", description = "Detalle con tiempo promedio de respuesta")
    @GetMapping("/entidad/{entidadId}")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticasPorEntidad(@Parameter(description = "ID de la entidad") @PathVariable Long entidadId) {
        Map<String, Object> stats = new HashMap<>();

        List<Solicitud> solicitudes = solicitudService.findByEntidadId(entidadId);

        stats.put("entidadId", entidadId);
        stats.put("totalSolicitudes", solicitudes.size());
        stats.put("pendientes", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())
                        || Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado()))
                .count());
        stats.put("respondidas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                .count());
        stats.put("denegadas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.DENEGADA.equals(s.getEstado()))
                .count());
        stats.put("vencidas", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.VENCIDA.equals(s.getEstado()))
                .count());

        List<Solicitud> respondidas = solicitudes.stream()
                .filter(s -> s.getRespuesta() != null && s.getFechaPresentacion() != null
                        && s.getRespuesta().getFechaRespuesta() != null)
                .collect(Collectors.toList());

        if (!respondidas.isEmpty()) {
            double promedioHoras = respondidas.stream()
                    .mapToLong(s -> ChronoUnit.HOURS.between(s.getFechaPresentacion(),
                            s.getRespuesta().getFechaRespuesta()))
                    .average()
                    .orElse(0);
            stats.put("tiempoPromedioRespuestaHoras", promedioHoras);
            stats.put("tiempoPromedioRespuestaDias", promedioHoras / 24);
        }

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Ranking de entidades", description = "Ordenadas por total de solicitudes, limitadas por parámetro")
    @GetMapping("/ranking/entidades")
    public ResponseEntity<List<Map<String, Object>>> obtenerRankingEntidades(
            @Parameter(description = "Número máximo de resultados") @RequestParam(defaultValue = "10") int limite) {

        List<Entidad> entidades = entidadService.findAll();

        List<Map<String, Object>> ranking = entidades.stream()
                .map(e -> {
                    Map<String, Object> item = new HashMap<>();
                    List<Solicitud> solicitudes = solicitudService.findByEntidadId(e.getId());
                    item.put("entidadId", e.getId());
                    item.put("entidadNombre", e.getNombre());
                    item.put("acronimo", e.getAcronimo());
                    item.put("totalSolicitudes", solicitudes.size());
                    item.put("respondidas", solicitudes.stream()
                            .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado()))
                            .count());
                    item.put("pendientes", solicitudes.stream()
                            .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())
                                    || Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado()))
                            .count());
                    return item;
                })
                .sorted((a, b) -> Integer.compare(
                        (int) b.get("totalSolicitudes"),
                        (int) a.get("totalSolicitudes")))
                .limit(limite)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ranking);
    }

    @Operation(summary = "Distribución de solicitudes por estado")
    @GetMapping("/distribucion/estados")
    public ResponseEntity<Map<String, Long>> obtenerDistribucionEstados() {
        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes();

        Map<String, Long> distribucion = new HashMap<>();
        distribucion.put("RECEPCIONADA", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())).count());
        distribucion.put("EN_REVISION", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())).count());
        distribucion.put("PENDIENTE_INFORMACION", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION.equals(s.getEstado())).count());
        distribucion.put("RESPONDIDA", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado())).count());
        distribucion.put("DENEGADA", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.DENEGADA.equals(s.getEstado())).count());
        distribucion.put("VENCIDA", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.VENCIDA.equals(s.getEstado())).count());
        distribucion.put("CONCLUIDA", solicitudes.stream()
                .filter(s -> Solicitud.EstadoSolicitud.CONCLUIDA.equals(s.getEstado())).count());

        return ResponseEntity.ok(distribucion);
    }

    @Operation(summary = "Tendencias mensuales", description = "Últimos 12 meses de solicitudes creadas")
    @GetMapping({"/tendencias/mensual", "/mensual"})
    public ResponseEntity<List<Map<String, Object>>> obtenerTendenciasMensuales() {
        List<Solicitud> solicitudes = solicitudService.obtenerTodasLasSolicitudes();
        LocalDateTime ahora = LocalDateTime.now();

        List<Map<String, Object>> tendencias = new ArrayList<>();

        for (int i = 11; i >= 0; i--) {
            LocalDateTime inicioMes = ahora.minusMonths(i).withDayOfMonth(1)
                    .withHour(0).withMinute(0).withSecond(0);
            LocalDateTime finMes = inicioMes.plusMonths(1);

            long count = solicitudes.stream()
                    .filter(s -> s.getFechaPresentacion() != null &&
                            s.getFechaPresentacion().isAfter(inicioMes) &&
                            s.getFechaPresentacion().isBefore(finMes))
                    .count();

            Map<String, Object> mes = new HashMap<>();
            mes.put("mes", inicioMes.getMonth().toString());
            mes.put("año", inicioMes.getYear());
            mes.put("totalSolicitudes", count);
            tendencias.add(mes);
        }

        return ResponseEntity.ok(tendencias);
    }
}
