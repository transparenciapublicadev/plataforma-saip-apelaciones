package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ActualizarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.ActualizarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.AmpliacionPlazoSolicitudDTO;
import pe.gob.saip.backend.model.dto.ConsultaPublicaSolicitudDTO;
import pe.gob.saip.backend.model.dto.CronogramaEntregaParcialDTO;
import pe.gob.saip.backend.model.dto.EncauzamientoSolicitudDTO;
import pe.gob.saip.backend.model.dto.LiquidacionCostoSolicitudDTO;
import pe.gob.saip.backend.model.dto.ObservacionSolicitudDTO;
import pe.gob.saip.backend.model.dto.ObservarSolicitudRequest;
import pe.gob.saip.backend.model.dto.PaginaDTO;
import pe.gob.saip.backend.model.dto.RegistrarAmpliacionPlazoRequest;
import pe.gob.saip.backend.model.dto.RegistrarEncauzamientoSolicitudRequest;
import pe.gob.saip.backend.model.dto.PlazoSeguimientoDTO;
import pe.gob.saip.backend.model.dto.RegistrarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.SolicitudDTO;
import pe.gob.saip.backend.model.dto.SolicitudResumenDTO;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.service.*;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.dto.IntentoNotificacionDTO;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/solicitudes")
@Tag(name = "Solicitudes SAIP", description = "Gestión de solicitudes de acceso a la información pública (Ley N° 27806)")
public class SolicitudRestController {

    private final SolicitudService solicitudService;
    private final CiudadanoService ciudadanoService;
    private final EntidadService entidadService;
    private final MotorNotificacionesService motorNotificacionesService;
    private final AutorizacionRecursosService autorizacionRecursosService;

    public SolicitudRestController(SolicitudService solicitudService,
                                    CiudadanoService ciudadanoService,
                                    EntidadService entidadService,
                                    MotorNotificacionesService motorNotificacionesService,
                                    AutorizacionRecursosService autorizacionRecursosService) {
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.entidadService = entidadService;
        this.motorNotificacionesService = motorNotificacionesService;
        this.autorizacionRecursosService = autorizacionRecursosService;
    }

    @Operation(summary = "Listar todas las solicitudes SAIP")
    @GetMapping
    public ResponseEntity<List<SolicitudDTO>> listar() {
        List<SolicitudDTO> solicitudes = autorizacionRecursosService
                .filtrarSolicitudesAccesibles(solicitudService.obtenerTodasLasSolicitudes())
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes SAIP con paginación y DTO liviano")
    @GetMapping("/paginadas")
    public ResponseEntity<PaginaDTO<SolicitudResumenDTO>> listarPaginadas(
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        return ResponseEntity.ok(PaginaDTO.from(
                solicitudService.obtenerPagina(crearPaginacion(pagina, tamano, "fechaPresentacion")),
                SolicitudResumenDTO::from));
    }

    @Operation(summary = "Obtener solicitud por ID")
    @GetMapping("/{id}")
    public ResponseEntity<SolicitudDTO> obtenerPorId(@Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        Solicitud solicitud = solicitudService.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + id));
        autorizacionRecursosService.verificarSolicitudAccesible(solicitud);
        return ResponseEntity.ok(SolicitudDTO.from(solicitud));
    }

    @Operation(summary = "Obtener solicitud por expediente", description = "Busca por formato SAIP-AAAA-NNNNN")
    @GetMapping("/expediente/{expediente}")
    public ResponseEntity<SolicitudDTO> obtenerPorExpediente(@Parameter(description = "Número de expediente SAIP") @PathVariable String expediente) {
        Solicitud solicitud = solicitudService.findByExpediente(expediente)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con expediente: " + expediente));
        autorizacionRecursosService.verificarSolicitudAccesible(solicitud);
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
        autorizacionRecursosService.verificarCiudadanoActualOPrivilegiado(ciudadanoId);
        List<SolicitudDTO> solicitudes = solicitudService.findByCiudadanoId(ciudadanoId)
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes SAIP de un ciudadano con paginación y DTO liviano")
    @GetMapping("/ciudadano/{ciudadanoId}/paginadas")
    public ResponseEntity<PaginaDTO<SolicitudResumenDTO>> listarPaginadasPorCiudadano(
            @Parameter(description = "ID del ciudadano") @PathVariable Long ciudadanoId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        autorizacionRecursosService.verificarCiudadanoActualOPrivilegiado(ciudadanoId);
        return ResponseEntity.ok(PaginaDTO.from(
                solicitudService.obtenerPaginaPorCiudadano(
                        ciudadanoId,
                        crearPaginacion(pagina, tamano, "fechaPresentacion")),
                SolicitudResumenDTO::from));
    }

    @Operation(summary = "Listar solicitudes por entidad")
    @GetMapping("/entidad/{entidadId}")
    public ResponseEntity<List<SolicitudDTO>> listarPorEntidad(@Parameter(description = "ID de la entidad") @PathVariable Long entidadId) {
        autorizacionRecursosService.verificarEntidadInstitucional(entidadId);
        List<SolicitudDTO> solicitudes = solicitudService.findByEntidadId(entidadId)
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes SAIP de una entidad con paginación y DTO liviano")
    @GetMapping("/entidad/{entidadId}/paginadas")
    public ResponseEntity<PaginaDTO<SolicitudResumenDTO>> listarPaginadasPorEntidad(
            @Parameter(description = "ID de la entidad") @PathVariable Long entidadId,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        autorizacionRecursosService.verificarEntidadInstitucional(entidadId);
        return ResponseEntity.ok(PaginaDTO.from(
                solicitudService.obtenerPaginaPorEntidad(
                        entidadId,
                        crearPaginacion(pagina, tamano, "fechaPresentacion")),
                SolicitudResumenDTO::from));
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

        List<SolicitudDTO> solicitudes = autorizacionRecursosService
                .filtrarSolicitudesAccesibles(solicitudService.obtenerSolicitudesPorEstado(estadoEnum))
                .stream()
                .map(SolicitudDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(solicitudes);
    }

    @Operation(summary = "Listar solicitudes por estado con paginación y DTO liviano")
    @GetMapping("/estado/{estado}/paginadas")
    public ResponseEntity<PaginaDTO<SolicitudResumenDTO>> listarPaginadasPorEstado(
            @Parameter(description = "Estado de la solicitud") @PathVariable String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano) {
        Solicitud.EstadoSolicitud estadoEnum;
        try {
            estadoEnum = Solicitud.EstadoSolicitud.valueOf(estado.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado no válido: " + estado);
        }
        return ResponseEntity.ok(PaginaDTO.from(
                solicitudService.obtenerPaginaPorEstado(estadoEnum, crearPaginacion(pagina, tamano, "fechaPresentacion")),
                SolicitudResumenDTO::from));
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
        autorizacionRecursosService.verificarCiudadanoActualOAdministrador(solicitudDTO.ciudadanoId());

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

    @Operation(summary = "Actualizar solicitud SAIP", description = "Edita asunto, descripción, tipo, consentimiento, canal y prioridad. Ignora estado, fechas y actuaciones; estas requieren su comando específico.")
    @PutMapping("/{id}")
    public ResponseEntity<SolicitudDTO> actualizar(@Parameter(description = "ID de la solicitud") @PathVariable Long id, @RequestBody SolicitudDTO solicitudDTO) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        Solicitud solicitud = solicitudService.actualizarDatos(id, solicitudDTO);

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
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.status(201).body(ObservacionSolicitudDTO.from(solicitudService.observarSolicitud(id, request)));
    }

    @Operation(summary = "Listar observaciones y subsanaciones SAIP")
    @GetMapping("/{id}/observaciones")
    public ResponseEntity<List<ObservacionSolicitudDTO>> listarObservaciones(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudAccesible(id);
        List<ObservacionSolicitudDTO> observaciones = solicitudService.listarObservaciones(id)
                .stream()
                .map(ObservacionSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(observaciones);
    }

    @Operation(
            summary = "Subsanar observación SAIP",
            description = "Registra comentario textual del ciudadano sobre una observación pendiente del expediente, dentro de plazo y sin respuesta. Los campos documentales no vacíos se rechazan (400); para archivos use la recepción multipart idempotente de precisiones."
    )
    @ApiResponses({
        @ApiResponse(responseCode="200", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=ObservacionSolicitudDTO.class))),
        @ApiResponse(responseCode="400", description="Metadatos documentales sin bytes o comentario ausente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="409", description="Actuación incompatible con el estado actual", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="422", description="Observación no pendiente o plazo vencido", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PostMapping("/{id}/observaciones/{observacionId}/subsanar")
    public ResponseEntity<ObservacionSolicitudDTO> subsanarSolicitud(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Parameter(description = "ID de la observación") @PathVariable Long observacionId,
            @Valid @RequestBody SubsanarSolicitudRequest request) {
        autorizacionRecursosService.verificarSolicitudAccesible(id);
        return ResponseEntity.ok(ObservacionSolicitudDTO.from(solicitudService.subsanarSolicitud(id, observacionId, request)));
    }

    @Operation(
            summary = "Procesar observaciones SAIP vencidas",
            description = "Revalida observaciones pendientes vencidas bajo bloqueo. Solo cierra como CONCLUIDA solicitudes PENDIENTE_INFORMACION sin respuesta; no sobrescribe recepciones o estados posteriores."
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
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.status(201).body(AmpliacionPlazoSolicitudDTO.from(solicitudService.registrarAmpliacion(id, request)));
    }

    @Operation(summary = "Listar ampliaciones de plazo de una SAIP")
    @GetMapping("/{id}/ampliaciones")
    public ResponseEntity<List<AmpliacionPlazoSolicitudDTO>> listarAmpliaciones(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudAccesible(id);
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
        autorizacionRecursosService.verificarSolicitudAccesible(id);
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
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.ok(CronogramaEntregaParcialDTO.from(
                solicitudService.actualizarEntregaParcial(id, ampliacionId, entregaId, request)));
    }

    @Operation(
            summary = "Registrar encauzamiento SAIP",
            description = "Registra el encauzamiento total o parcial de una SAIP a la entidad competente dentro de los 2 días hábiles."
    )
    @PostMapping("/{id}/encauzamientos")
    public ResponseEntity<EncauzamientoSolicitudDTO> registrarEncauzamiento(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Valid @RequestBody RegistrarEncauzamientoSolicitudRequest request) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.status(201).body(EncauzamientoSolicitudDTO.from(
                solicitudService.registrarEncauzamiento(id, request)));
    }

    @Operation(summary = "Listar encauzamientos de una SAIP")
    @GetMapping("/{id}/encauzamientos")
    public ResponseEntity<List<EncauzamientoSolicitudDTO>> listarEncauzamientos(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarTrazabilidadEncauzamientoAccesible(id);
        List<EncauzamientoSolicitudDTO> encauzamientos = solicitudService.listarEncauzamientos(id)
                .stream()
                .map(EncauzamientoSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(encauzamientos);
    }

    @Operation(summary = "Consultar encauzamiento activo de una SAIP")
    @GetMapping("/{id}/encauzamientos/activo")
    public ResponseEntity<EncauzamientoSolicitudDTO> obtenerEncauzamientoActivo(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarTrazabilidadEncauzamientoAccesible(id);
        return solicitudService.obtenerEncauzamientoActivo(id)
                .map(EncauzamientoSolicitudDTO::from)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new RecursoNoEncontradoException("La solicitud no tiene encauzamiento activo"));
    }

    @Operation(
            summary = "Emitir liquidación o cupón SAIP",
            description = "Registra y notifica el cupón de pago para entrega física hasta el día 9 de atención y calcula 30 días hábiles para recojo."
    )
    @PostMapping("/{id}/liquidaciones")
    public ResponseEntity<LiquidacionCostoSolicitudDTO> emitirLiquidacion(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Valid @RequestBody RegistrarLiquidacionCostoRequest request) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.status(201).body(LiquidacionCostoSolicitudDTO.from(
                solicitudService.emitirLiquidacion(id, request)));
    }

    @Operation(summary = "Listar liquidaciones o cupones de una SAIP")
    @GetMapping("/{id}/liquidaciones")
    public ResponseEntity<List<LiquidacionCostoSolicitudDTO>> listarLiquidaciones(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudAccesible(id);
        List<LiquidacionCostoSolicitudDTO> liquidaciones = solicitudService.listarLiquidaciones(id)
                .stream()
                .map(LiquidacionCostoSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(liquidaciones);
    }

    @Operation(summary = "Consultar liquidación o cupón activo de una SAIP")
    @GetMapping("/{id}/liquidaciones/activa")
    public ResponseEntity<LiquidacionCostoSolicitudDTO> obtenerLiquidacionActiva(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudAccesible(id);
        return solicitudService.obtenerLiquidacionActiva(id)
                .map(LiquidacionCostoSolicitudDTO::from)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new RecursoNoEncontradoException("La solicitud no tiene liquidación o cupón activo"));
    }

    @Operation(summary = "Actualizar pago o recojo de liquidación SAIP")

    @ApiResponses({
        @ApiResponse(responseCode="200", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=LiquidacionCostoSolicitudDTO.class))),
        @ApiResponse(responseCode="409", description="Solicitud incompatible, ya respondida o con observación pendiente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PatchMapping("/{id}/liquidaciones/{liquidacionId}")
    public ResponseEntity<LiquidacionCostoSolicitudDTO> actualizarLiquidacion(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Parameter(description = "ID de la liquidación") @PathVariable Long liquidacionId,
            @Valid @RequestBody ActualizarLiquidacionCostoRequest request) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        return ResponseEntity.ok(LiquidacionCostoSolicitudDTO.from(
                solicitudService.actualizarLiquidacion(id, liquidacionId, request)));
    }

    @Operation(
            summary = "Procesar liquidaciones vencidas por no recojo",
            description = "Archiva/cierra solicitudes con liquidación notificada cuyo plazo de recojo de 30 días hábiles venció."
    )
    @PostMapping("/liquidaciones/vencidas/procesar")
    public ResponseEntity<List<LiquidacionCostoSolicitudDTO>> procesarLiquidacionesVencidas() {
        List<LiquidacionCostoSolicitudDTO> liquidaciones = solicitudService.procesarLiquidacionesVencidas()
                .stream()
                .map(LiquidacionCostoSolicitudDTO::from)
                .toList();
        return ResponseEntity.ok(liquidaciones);
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

    @Operation(summary = "Cambiar estado de solicitud", description = "Solo permite RECEPCIONADA a EN_REVISION sin respuesta ni observación pendiente, o consultar el mismo estado sin nueva actuación. Los demás cambios requieren su comando específico (409).")
    @ApiResponses({
        @ApiResponse(responseCode="200", description="Actuación o datos persistidos", content=@Content(schema=@Schema(implementation=SolicitudDTO.class))),
        @ApiResponse(responseCode="409", description="La transición exige una actuación o es incompatible con el expediente", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class))),
        @ApiResponse(responseCode="422", description="Valor de estado ausente o no reconocido", content=@Content(mediaType="application/problem+json", schema=@Schema(implementation=org.springframework.http.ProblemDetail.class)))
    })
    @PatchMapping("/{id}/estado")
    public ResponseEntity<SolicitudDTO> cambiarEstado(@Parameter(description = "ID de la solicitud") @PathVariable Long id, @RequestBody Map<String, String> body) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        Solicitud solicitud = solicitudService.cambiarEstado(id, body.get("estado"));

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
        autorizacionRecursosService.verificarCiudadanoActualOPrivilegiado(ciudadanoId);
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
        autorizacionRecursosService.verificarEntidadInstitucional(entidadId);
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

    @Operation(summary = "Enviar notificación para solicitud SAIP")
    @PostMapping("/{id}/notificaciones/enviar")
    public ResponseEntity<IntentoNotificacionDTO> enviarNotificacion(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id,
            @Valid @RequestBody EnviarNotificacionRequest request) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        IntentoNotificacion intento = motorNotificacionesService.enviarNotificacionSaip(id, request);
        return ResponseEntity.status(201).body(IntentoNotificacionDTO.from(intento));
    }

    @Operation(summary = "Listar intentos de notificación de una solicitud SAIP")
    @GetMapping("/{id}/notificaciones/intentos")
    public ResponseEntity<List<IntentoNotificacionDTO>> listarIntentos(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        List<IntentoNotificacionDTO> intentos = motorNotificacionesService.listarIntentosSaip(id)
                .stream()
                .map(IntentoNotificacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(intentos);
    }

    @Operation(summary = "Obtener seguimiento de plazo de una solicitud SAIP")
    @GetMapping("/{id}/plazo-seguimiento")
    public ResponseEntity<PlazoSeguimientoDTO> obtenerSeguimientoPlazo(
            @Parameter(description = "ID de la solicitud") @PathVariable Long id) {
        autorizacionRecursosService.verificarSolicitudInstitucional(id);
        PlazoSeguimientoDTO dto = solicitudService.obtenerSeguimientoPlazo(id);
        return ResponseEntity.ok(dto);
    }

    private Pageable crearPaginacion(int pagina, int tamano, String orden) {
        if (pagina < 0) {
            throw new IllegalArgumentException("El número de página no puede ser negativo");
        }
        if (tamano < 1 || tamano > 100) {
            throw new IllegalArgumentException("El tamaño de página debe estar entre 1 y 100");
        }
        return PageRequest.of(pagina, tamano, Sort.by(Sort.Direction.DESC, orden));
    }
}

