package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ActualizarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.AmpliacionPlazoSolicitudDTO;
import pe.gob.saip.backend.model.dto.ConsultaPublicaSolicitudDTO;
import pe.gob.saip.backend.model.dto.CronogramaEntregaParcialDTO;
import pe.gob.saip.backend.model.dto.ObservacionSolicitudDTO;
import pe.gob.saip.backend.model.dto.ObservarSolicitudRequest;
import pe.gob.saip.backend.model.dto.RegistrarAmpliacionPlazoRequest;
import pe.gob.saip.backend.model.dto.SolicitudDTO;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/solicitudes")
@Tag(name = "Solicitudes SAIP", description = "Gestión de solicitudes de acceso a la información pública (Ley N° 27806)")
public class SolicitudRestController {

    private final SolicitudService solicitudService;
    private final CiudadanoService ciudadanoService;
    private final EntidadService entidadService;

    public SolicitudRestController(SolicitudService solicitudService,
                                    CiudadanoService ciudadanoService,
                                    EntidadService entidadService) {
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.entidadService = entidadService;
    }

    @Operation(summary = "Listar todas las solicitudes SAIP")
    @GetMapping
    public ResponseEntity<List<SolicitudDTO>> listar() {
        List<SolicitudDTO> solicitudes = solicitudService.obtenerTodasLasSolicitudes()
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Obtener solicitud por ID")
    @GetMapping("/{id}")
    public ResponseEntity<SolicitudDTO> obtenerPorId(@Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        Solicitud solicitud = solicitudService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + id));
        return ResponseEntity.ok(SolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Obtener solicitud por expediente", description = "Busca por formato SAIP-AAAA-NNNNN")
    @GetMapping("/expediente/{expediente}")
    public ResponseEntity<SolicitudDTO> obtenerPorExpediente(@Parameter(description = "Número de expediente SAIP") @PathVariable String expediente) {
        Solicitud solicitud = solicitudService.findByExpediente(expediente)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con expediente: " + expediente));
        return ResponseEntity.ok(SolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Consulta pública enmascarada de solicitud por expediente")
    @GetMapping("/publica/expediente/{expediente}")
    public ResponseEntity<ConsultaPublicaSolicitudDTO> obtenerPublicaPorExpediente(
            @Parameter(description = "Número de expediente SAIP") @PathVariable String expediente) {
        Solicitud solicitud = solicitudService.findByExpediente(expediente)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con expediente: " + expediente));
        return ResponseEntity.ok(ConsultaPublicaSolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Listar solicitudes por ciudadano")
    @GetMapping("/ciudadano/{ciudadanoId}")
    public ResponseEntity<List<SolicitudDTO>> listarPorCiudadano(@Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId) {
        List<SolicitudDTO> solicitudes = solicitudService.findByCiudadanoId(ciudadanoId)
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes por entidad")
    @GetMapping("/entidad/{entidadId}")
    public ResponseEntity<List<SolicitudDTO>> listarPorEntidad(@Parameter(description = "ID de la entidad") @PathVariable Long entidadId) {
        List<SolicitudDTO> solicitudes = solicitudService.findByEntidadId(entidadId)
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes por estado", description = "Estados: RECEPCIONADA, EN_REVISION, PENDIENTE_INFORMACION, RESPONDIDA, DENEGADA, CONCLUIDA, VENCIDA")
    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<SolicitudDTO>> listarPorEstado(@Parameter(description = "Estado de la solicitud") @PathVariable String estado) {
        Solicitud.EstadoSolicitud estadoEnum;
        try {
            estadoEnum = Solicitud.EstadoSolicitud.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + estado);
        }

        List<SolicitudDTO> solicitudes = solicitudService.obtenerSolicitudesPorEstado(estadoEnum)
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Crear solicitud SAIP", description = "Genera automáticamente expediente y fecha límite (10 días hábiles)")
    @PostMapping
    public ResponseEntity<SolicitudDTO> crear(@RequestBody SolicitudDTO solicitudDTO) {
        if (solicitudDTO.ciudadanoId() == null) {
            throw new IllegalArgumentException("El ID del ciudadano es obligatorio");
        }
        if (solicitudDTO.entidadId() == null) {
            throw new IllegalArgumentException("El ID de la entidad es obligatorio");
        }
        if (!Boolean.TRUE.equals(solicitudDTO.consentimientoDatosPersonales())) {
            throw new IllegalArgumentException("Debe aceptar el tratamiento de datos personales para presentar la SAIP");
        }

        Ciudadano ciudadano = ciudadanoService.findById(solicitudDTO.ciudadanoId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Ciudadano no encontrado con ID: " + solicitudDTO.ciudadanoId()));

        Entidad entidad = entidadService.findById(solicitudDTO.entidadId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad no encontrada con ID: " + solicitudDTO.entidadId()));

        Solicitud solicitud = new Solicitud();
        solicitud.setAsunto(solicitudDTO.asunto());
        solicitud.setDescripcion(solicitudDTO.descripcion());
        solicitud.setTipoInformacion(solicitudDTO.tipoInformacion());
        solicitud.setFormatoDigital(solicitudDTO.formatoDigital() != null ? solicitudDTO.formatoDigital() : false);
        solicitud.setFormatoFisico(solicitudDTO.formatoFisico() != null ? solicitudDTO.formatoFisico() : false);
        solicitud.setCopiaSimple(solicitudDTO.copiaSimple() != null ? solicitudDTO.copiaSimple() : false);
        solicitud.setCopiaCertificada(solicitudDTO.copiaCertificada() != null ? solicitudDTO.copiaCertificada() : false);
        solicitud.setConsentimientoDatosPersonales(true);
        solicitud.setCanalNotificacion(parseCanalNotificacion(solicitudDTO.canalNotificacion()));
        solicitud.setCiudadano(ciudadano);
        solicitud.setEntidad(entidad);
        solicitud.setEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);
        solicitud.setPrioridad(Solicitud.Prioridad.MEDIA);

        solicitud = solicitudService.save(solicitud);

        return ResponseEntity.status(201).body(SolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Actualizar solicitud SAIP")
    @PutMapping("/{id}")
    public ResponseEntity<SolicitudDTO> actualizar(@Parameter(description = "ID de la solicitud") @PathVariable Long id, @RequestBody SolicitudDTO solicitudDTO) {
        Solicitud solicitud = solicitudService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + id));

        if (solicitudDTO.asunto() != null) {
            solicitud.setAsunto(solicitudDTO.asunto());
        }
        if (solicitudDTO.descripcion() != null) {
            solicitud.setDescripcion(solicitudDTO.descripcion());
        }
        if (solicitudDTO.tipoInformacion() != null) {
            solicitud.setTipoInformacion(solicitudDTO.tipoInformacion());
        }
        if (solicitudDTO.consentimientoDatosPersonales() != null) {
            if (!Boolean.TRUE.equals(solicitudDTO.consentimientoDatosPersonales())) {
                throw new IllegalArgumentException("El consentimiento de tratamiento de datos personales no puede retirarse desde este endpoint");
            }
            solicitud.setConsentimientoDatosPersonales(true);
        }
        if (solicitudDTO.canalNotificacion() != null) {
            solicitud.setCanalNotificacion(parseCanalNotificacion(solicitudDTO.canalNotificacion()));
        }
        if (solicitudDTO.prioridad() != null) {
            try {
                solicitud.setPrioridad(Solicitud.Prioridad.valueOf(solicitudDTO.prioridad().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException(
                        "Prioridad no válida: " + solicitudDTO.prioridad()
                        + ". Valores permitidos: BAJA, NORMAL, MEDIA, ALTA, URGENTE");
            }
        }

        solicitud = solicitudService.save(solicitud);

        return ResponseEntity.ok(SolicitudDTO.from(solicitud));
    }

    @Operation(
            summary = "Observar solicitud SAIP",
            description = "Registra una observación formal dentro de los 2 primeros días hábiles y abre plazo de subsanación ciudadana de 2 días hábiles."
    )
    @PostMapping("/{id}/observaciones")
    public ResponseEntity<ObservacionSolicitudDTO> observarSolicitud(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Valid @RequestBody ObservarSolicitudRequest request) {
        return ResponseEntity.status(201).body(ObservacionSolicitudDTO.from(solicitudService.observarSolicitud(id, request)));
    }

    @Operation(summary = "Listar observaciones y subsanaciones SAIP")
    @GetMapping("/{id}/observaciones")
    public ResponseEntity<List<ObservacionSolicitudDTO>> listarObservaciones(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        List<ObservacionSolicitudDTO> observaciones = solicitudService.listarObservaciones(id)
                .stream()
                .map(ObservacionSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(observaciones);
    }

    @Operation(
            summary = "Subsanar observación SAIP",
            description = "Registra la subsanación ciudadana dentro del plazo de 2 días hábiles y devuelve la solicitud a revisión."
    )
    @PostMapping("/{id}/observaciones/{observacionId}/subsanar")
    public ResponseEntity<ObservacionSolicitudDTO> subsanarSolicitud(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Parameter(description = "ID de la observación") @PathVariable Long observacionId,
            @Valid @RequestBody SubsanarSolicitudRequest request) {
        return ResponseEntity.ok(ObservacionSolicitudDTO.from(solicitudService.subsanarSolicitud(id, observacionId, request)));
    }

    @Operation(
            summary = "Procesar observaciones SAIP vencidas",
            description = "Marca observaciones pendientes vencidas como no subsanadas y cierra la solicitud como CONCLUIDA."
    )
    @PostMapping("/observaciones/vencidas/procesar")
    public ResponseEntity<List<ObservacionSolicitudDTO>> procesarObservacionesVencidas() {
        List<ObservacionSolicitudDTO> observaciones = solicitudService.procesarObservacionesVencidas()
                .stream()
                .map(ObservacionSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(observaciones);
    }

    @Operation(
            summary = "Registrar ampliación de plazo SAIP",
            description = "Registra y notifica una ampliación dentro del día 4 de atención, con informe y cronograma de entregas parciales."
    )
    @PostMapping("/{id}/ampliaciones")
    public ResponseEntity<AmpliacionPlazoSolicitudDTO> registrarAmpliacion(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Valid @RequestBody RegistrarAmpliacionPlazoRequest request) {
        return ResponseEntity.status(201).body(AmpliacionPlazoSolicitudDTO.from(solicitudService.registrarAmpliacion(id, request)));
    }

    @Operation(summary = "Listar ampliaciones de plazo de una SAIP")
    @GetMapping("/{id}/ampliaciones")
    public ResponseEntity<List<AmpliacionPlazoSolicitudDTO>> listarAmpliaciones(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        List<AmpliacionPlazoSolicitudDTO> ampliaciones = solicitudService.listarAmpliaciones(id)
                .stream()
                .map(AmpliacionPlazoSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(ampliaciones);
    }

    @Operation(summary = "Consultar cronograma de entregas parciales de una SAIP")
    @GetMapping("/{id}/ampliaciones/cronograma")
    public ResponseEntity<List<CronogramaEntregaParcialDTO>> listarCronogramaAmpliacion(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        List<CronogramaEntregaParcialDTO> entregas = solicitudService.listarCronogramaAmpliacion(id)
                .stream()
                .map(CronogramaEntregaParcialDTO::from)
                .toList();
        return ResponseEntity.ok(entregas);
    }

    @Operation(summary = "Actualizar estado de una entrega parcial SAIP")
    @PatchMapping("/{id}/ampliaciones/{ampliacionId}/cronograma/{entregaId}")
    public ResponseEntity<CronogramaEntregaParcialDTO> actualizarEntregaParcial(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Parameter(description = "ID de la ampliación") @PathVariable Long ampliacionId,
            @Parameter(description = "ID de la entrega parcial") @PathVariable Long entregaId,
            @Valid @RequestBody ActualizarEntregaParcialRequest request) {
        return ResponseEntity.ok(CronogramaEntregaParcialDTO.from(
                solicitudService.actualizarEntregaParcial(id, ampliacionId, entregaId, request)));
    }

    private Solicitud.CanalNotificacion parseCanalNotificacion(String canal) {
        if (canal == null || canal.isBlank()) {
            throw new IllegalArgumentException("El canal de notificación es obligatorio");
        }

        try {
            return Solicitud.CanalNotificacion.valueOf(canal.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Canal de notificación no válido: " + canal
                    + ". Valores permitidos: CORREO_ELECTRONICO, CASILLA_ELECTRONICA, PLATAFORMA, FISICA");
        }
    }

    @Operation(summary = "Cambiar estado de solicitud")
    @PatchMapping("/{id}/estado")
    public ResponseEntity<SolicitudDTO> cambiarEstado(@Parameter(description = "ID de la solicitud") @PathVariable Long id, @RequestBody Map<String, String> body) {
        Solicitud solicitud = solicitudService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + id));

        String nuevoEstado = body.get("estado");
        try {
            solicitud.setEstado(Solicitud.EstadoSolicitud.valueOf(nuevoEstado.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + nuevoEstado);
        }

        solicitud = solicitudService.save(solicitud);

        return ResponseEntity.ok(SolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Estadísticas generales de solicitudes")
    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticas() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", solicitudService.count());
        stats.put("recepcionadas", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA));
        stats.put("enRevision", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.EN_REVISION));
        stats.put("respondidas", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.RESPONDIDA));
        stats.put("denegadas", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.DENEGADA));
        stats.put("concluidas", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.CONCLUIDA));
        stats.put("vencidas", solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.VENCIDA));

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Estadísticas de solicitudes por ciudadano")
    @GetMapping("/ciudadano/{ciudadanoId}/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticasPorCiudadano(@Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId) {
        List<Solicitud> solicitudes = solicitudService.findByCiudadanoId(ciudadanoId);

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", solicitudes.size());
        stats.put("recepcionadas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())).count());
        stats.put("enRevision", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())).count());
        stats.put("respondidas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado())).count());
        stats.put("apeladas", solicitudes.stream().filter(s -> s.getApelacion() != null).count());

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Estadísticas de solicitudes por entidad", description = "Incluye conteo de solicitudes urgentes")
    @GetMapping("/entidad/{entidadId}/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticasPorEntidad(@Parameter(description = "ID de la entidad") @PathVariable Long entidadId) {
        List<Solicitud> solicitudes = solicitudService.findByEntidadId(entidadId);

        Map<String, Object> stats = new HashMap<>();
        stats.put("total", solicitudes.size());
        stats.put("recepcionadas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RECEPCIONADA.equals(s.getEstado())).count());
        stats.put("enRevision", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.EN_REVISION.equals(s.getEstado())).count());
        stats.put("respondidas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.RESPONDIDA.equals(s.getEstado())).count());
        stats.put("vencidas", solicitudes.stream().filter(s -> Solicitud.EstadoSolicitud.VENCIDA.equals(s.getEstado())).count());
        stats.put("urgentes", solicitudes.stream().filter(s -> s.getDiasRestantes() >= 0 && s.getDiasRestantes() <= 3).count());

        return ResponseEntity.ok(stats);
    }

    @Operation(summary = "Eliminar solicitud SAIP")
    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> eliminar(@Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        solicitudService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + id));
        solicitudService.eliminarSolicitud(id);

        Map<String, Object> response = new HashMap<>();
        response.put("mensaje", "Solicitud eliminada correctamente");
        response.put("id", id);

        return ResponseEntity.ok(response);
    }
}

