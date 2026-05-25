package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DescargoEntidadTtaipRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.HistorialTtaipRepository;
import pe.gob.saip.backend.repository.NotificacionTtaipRepository;
import pe.gob.saip.backend.repository.ReprocesoNotificacionRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.SalaTtaipRepository;
import pe.gob.saip.backend.repository.SuspensionPlazoTtaipRepository;
import pe.gob.saip.backend.model.dto.CancelarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.PresentarDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.RegistrarAcuseAutomaticoNotificacionRequest;
import pe.gob.saip.backend.model.dto.RegistrarConstanciaEnvioNotificacionRequest;
import pe.gob.saip.backend.model.dto.RegistrarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.RequerirDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.ValidarNotificacionManualRequest;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class ExpedienteTtaipService {

    private static final String PRIMERA_SALA = "PRIMERA SALA";
    private static final String SEGUNDA_SALA = "SEGUNDA SALA";
    private static final int RESOLUCION_BASE = 1595;
    private static final int CEDULA_BASE = 15203;
    private static final int DIAS_SUSPENSION_ADICIONAL = 3;

    private final ExpedienteTtaipRepository expedienteRepository;
    private final SalaTtaipRepository salaRepository;
    private final MiembroTTAIPService miembroService;
    private final ResolucionRepository resolucionRepository;
    private final CedulaNotificacionRepository cedulaRepository;
    private final NotificacionTtaipRepository notificacionRepository;
    private final ReprocesoNotificacionRepository reprocesoRepository;
    private final HistorialTtaipRepository historialRepository;
    private final DescargoEntidadTtaipRepository descargoRepository;
    private final SuspensionPlazoTtaipRepository suspensionRepository;

    public ExpedienteTtaipService(ExpedienteTtaipRepository expedienteRepository,
                                  SalaTtaipRepository salaRepository,
                                  MiembroTTAIPService miembroService,
                                  ResolucionRepository resolucionRepository,
                                  CedulaNotificacionRepository cedulaRepository,
                                  NotificacionTtaipRepository notificacionRepository,
                                  ReprocesoNotificacionRepository reprocesoRepository,
                                  HistorialTtaipRepository historialRepository,
                                  DescargoEntidadTtaipRepository descargoRepository,
                                  SuspensionPlazoTtaipRepository suspensionRepository) {
        this.expedienteRepository = expedienteRepository;
        this.salaRepository = salaRepository;
        this.miembroService = miembroService;
        this.resolucionRepository = resolucionRepository;
        this.cedulaRepository = cedulaRepository;
        this.notificacionRepository = notificacionRepository;
        this.reprocesoRepository = reprocesoRepository;
        this.historialRepository = historialRepository;
        this.descargoRepository = descargoRepository;
        this.suspensionRepository = suspensionRepository;
    }

    @Transactional
    public ExpedienteTtaip obtenerOCrearParaApelacion(Apelacion apelacion) {
        if (apelacion.getId() == null) {
            throw new IllegalArgumentException("La apelación debe estar guardada antes de crear el expediente TTAIP");
        }

        return expedienteRepository.findByApelacion_IdApelacion(apelacion.getId())
                .map(expediente -> sincronizarEstado(expediente, apelacion))
                .orElseGet(() -> crearExpediente(apelacion));
    }

    @Transactional
    public Resolucion prepararResolucion(Resolucion resolucion) {
        ExpedienteTtaip expediente = obtenerOCrearParaApelacion(resolucion.getApelacion());
        resolucion.setExpedienteTtaip(expediente);
        resolucion.setSalaTtaip(expediente.getSala());

        if (resolucion.getNumeroResolucion() == null || resolucion.getNumeroResolucion().isBlank()) {
            resolucion.setNumeroResolucion(generarNumeroResolucion(expediente));
        }

        return resolucion;
    }

    @Transactional
    public void registrarResolucion(Resolucion resolucion) {
        if (resolucion.getId() == null) {
            throw new IllegalArgumentException("La resolución debe estar guardada antes de generar cédulas");
        }

        ExpedienteTtaip expediente = resolucion.getExpedienteTtaip() != null
                ? resolucion.getExpedienteTtaip()
                : obtenerOCrearParaApelacion(resolucion.getApelacion());

        actualizarFechasPorResolucion(expediente, resolucion);
        expediente.setEstado(resolucion.getApelacion().getEstado());
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - %s emitida por %s".formatted(
                        LocalDateTime.now(),
                        resolucion.getTipoResolucion(),
                        resolucion.getSalaTtaip() != null ? resolucion.getSalaTtaip().getNombre() : "sala TTAIP"
                )
        ));
        expedienteRepository.save(expediente);
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.RESOLUCION_EMITIDA,
                "%s registrada en %s".formatted(
                        resolucion.getTipoResolucion(),
                        resolucion.getSalaTtaip() != null ? resolucion.getSalaTtaip().getNombre() : "sala TTAIP"
                ),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                "TTAIP",
                resolucion.getNumeroResolucion()
        );

        crearCedulaYNotificacionSiFalta(resolucion, expediente, CedulaNotificacion.DestinatarioNotificacion.CIUDADANO);
        if (debeNotificarEntidadPublica(resolucion)) {
            crearCedulaYNotificacionSiFalta(resolucion, expediente, CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA);
        }
    }

    @Transactional
    public ReprocesoNotificacion reprocesarNotificacionFallida(String numeroCedulaOriginal,
                                                               CedulaNotificacion.DestinatarioNotificacion destinatario,
                                                               String observacion,
                                                               String responsable) {
        NotificacionTtaip notificacionOriginal = notificacionRepository
                .findByCedula_NumeroCedulaAndDestinatario(numeroCedulaOriginal, destinatario)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Notificación no encontrada para la cédula " + numeroCedulaOriginal + " y destinatario " + destinatario));

        return reprocesarNotificacionFallida(notificacionOriginal, observacion, responsable);
    }

    @Transactional(readOnly = true)
    public List<NotificacionTtaip> listarNotificaciones(Long expedienteId) {
        buscarExpediente(expedienteId);
        return notificacionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaNotificacionAsc(expedienteId);
    }

    @Transactional(readOnly = true)
    public NotificacionTtaip obtenerNotificacion(Long expedienteId, Long notificacionId) {
        return buscarNotificacion(expedienteId, notificacionId);
    }

    @Transactional
    public NotificacionTtaip registrarConstanciaEnvio(Long expedienteId,
                                                       Long notificacionId,
                                                       RegistrarConstanciaEnvioNotificacionRequest request) {
        NotificacionTtaip notificacion = buscarNotificacion(expedienteId, notificacionId);
        String medio = normalizarTexto(request.medioNotificacion(), "CASILLA_ELECTRONICA");
        String responsable = normalizarActor(request.responsable(), "TTAIP");
        LocalDateTime fechaEnvio = request.fechaEnvio() != null ? request.fechaEnvio() : LocalDateTime.now();

        notificacion.setMedio(medio);
        notificacion.setMedioNotificacion(medio);
        notificacion.setFechaEnvio(fechaEnvio);
        notificacion.setCodigoEnvio(normalizarNullable(request.codigoEnvio()));
        notificacion.setCodigoConstancia(normalizarNullable(request.codigoConstancia()));
        notificacion.setConstanciaEnvio(request.constanciaEnvio().trim());
        notificacion.setEvidenciaUrl(normalizarNullable(request.evidenciaUrl()));
        notificacion.setReferenciaEvidencia(normalizarNullable(request.referenciaEvidencia()));
        notificacion.setResponsableConstancia(responsable);
        notificacion.setObservacionConstancia(normalizarNullable(request.observacion()));
        notificacion.setEstado("ENVIADA");
        notificacion.setResultadoNotificacion("ENVIADA");
        notificacion.setTrazabilidad(agregarTraza(
                notificacion.getTrazabilidad(),
                "%s - Constancia de envío registrada por %s; medio=%s; codigoEnvio=%s; codigoConstancia=%s".formatted(
                        LocalDateTime.now(),
                        responsable,
                        medio,
                        valorTraza(notificacion.getCodigoEnvio()),
                        valorTraza(notificacion.getCodigoConstancia())
                )
        ));

        NotificacionTtaip saved = notificacionRepository.save(notificacion);
        registrarHistorial(
                saved.getExpediente(),
                HistorialTtaip.TipoEvento.CONSTANCIA_ENVIO_REGISTRADA,
                "Constancia de envío registrada para " + etiquetaDestinatario(saved.getDestinatario()),
                null,
                saved.getEstado(),
                responsable,
                "NOTIFICACION-" + saved.getId() + ":CONSTANCIA"
        );
        return saved;
    }

    @Transactional
    public NotificacionTtaip registrarAcuseAutomatico(Long expedienteId,
                                                       Long notificacionId,
                                                       RegistrarAcuseAutomaticoNotificacionRequest request) {
        NotificacionTtaip notificacion = buscarNotificacion(expedienteId, notificacionId);
        String estadoAcuse = normalizarEstadoAcuse(request.estadoAcuse());
        String responsable = normalizarActor(request.responsable(), "SISTEMA_NOTIFICACIONES");
        LocalDateTime fechaAcuse = request.fechaAcuse() != null ? request.fechaAcuse() : LocalDateTime.now();
        String estadoNotificacion = estadoDesdeAcuse(estadoAcuse);
        String resultado = normalizarTexto(request.resultadoNotificacion(), estadoNotificacion);

        notificacion.setAcuseAutomatico(request.acuseAutomatico().trim());
        notificacion.setFechaAcuse(fechaAcuse);
        notificacion.setEstadoAcuse(estadoAcuse);
        notificacion.setResultadoNotificacion(resultado);
        notificacion.setEstado(estadoNotificacion);
        actualizarEvidencia(notificacion, request.evidenciaUrl(), request.referenciaEvidencia());
        notificacion.setTrazabilidad(agregarTraza(
                notificacion.getTrazabilidad(),
                "%s - Acuse automático registrado por %s; estadoAcuse=%s; resultado=%s".formatted(
                        LocalDateTime.now(),
                        responsable,
                        estadoAcuse,
                        resultado
                )
        ));

        NotificacionTtaip saved = notificacionRepository.save(notificacion);
        registrarHistorial(
                saved.getExpediente(),
                HistorialTtaip.TipoEvento.ACUSE_NOTIFICACION_REGISTRADO,
                "Acuse automático " + estadoAcuse + " registrado para " + etiquetaDestinatario(saved.getDestinatario()),
                null,
                saved.getEstado(),
                responsable,
                "NOTIFICACION-" + saved.getId() + ":ACUSE:" + estadoAcuse
        );
        return saved;
    }

    @Transactional
    public NotificacionTtaip validarNotificacionManualmente(Long expedienteId,
                                                            Long notificacionId,
                                                            ValidarNotificacionManualRequest request) {
        NotificacionTtaip notificacion = buscarNotificacion(expedienteId, notificacionId);
        validarSustentoManual(notificacion, request);
        String responsable = normalizarActor(request.responsableValidacion(), "TTAIP");
        LocalDateTime fechaValidacion = request.fechaValidacionManual() != null
                ? request.fechaValidacionManual()
                : LocalDateTime.now();

        notificacion.setValidadaManualmente(Boolean.TRUE);
        notificacion.setFechaValidacionManual(fechaValidacion);
        notificacion.setResponsableValidacion(responsable);
        notificacion.setObservacionValidacion(request.observacionValidacion().trim());
        actualizarEvidencia(notificacion, request.evidenciaUrl(), request.referenciaEvidencia());
        notificacion.setEstado("VALIDADA");
        notificacion.setResultadoNotificacion("VALIDADA_MANUALMENTE");
        notificacion.setTrazabilidad(agregarTraza(
                notificacion.getTrazabilidad(),
                "%s - Notificación validada manualmente por %s; observación=%s".formatted(
                        LocalDateTime.now(),
                        responsable,
                        request.observacionValidacion().trim()
                )
        ));

        NotificacionTtaip saved = notificacionRepository.save(notificacion);
        registrarHistorial(
                saved.getExpediente(),
                HistorialTtaip.TipoEvento.NOTIFICACION_VALIDADA,
                "Notificación validada manualmente para " + etiquetaDestinatario(saved.getDestinatario()),
                null,
                saved.getEstado(),
                responsable,
                "NOTIFICACION-" + saved.getId() + ":VALIDACION_MANUAL"
        );
        return saved;
    }

    @Transactional(readOnly = true)
    public List<DescargoEntidadTtaip> listarDescargos(Long expedienteId) {
        return descargoRepository.findByExpediente_IdExpedienteTtaipOrderByFechaRequerimientoDesc(expedienteId);
    }

    @Transactional(readOnly = true)
    public DescargoEntidadTtaip obtenerDescargoActivo(Long expedienteId) {
        return descargoRepository
                .findFirstByExpediente_IdExpedienteTtaipAndEstadoDescargoInOrderByFechaRequerimientoDesc(
                        expedienteId,
                        estadosDescargoActivos())
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "No existe descargo activo para el expediente TTAIP ID: " + expedienteId));
    }

    @Transactional
    public DescargoEntidadTtaip requerirDescargos(Long expedienteId, RequerirDescargoEntidadRequest request) {
        ExpedienteTtaip expediente = buscarExpediente(expedienteId);
        validarExpedienteAdmitido(expediente);

        if (descargoRepository.existsByExpediente_IdExpedienteTtaipAndEstadoDescargoIn(
                expedienteId,
                estadosDescargoActivos())) {
            throw new IllegalArgumentException("Ya existe un requerimiento de descargos activo para este expediente TTAIP");
        }

        Entidad entidad = entidadRequerida(expediente);
        LocalDate fechaRequerimiento = request.fechaRequerimiento() != null
                ? request.fechaRequerimiento()
                : LocalDate.now();
        LocalDate inicioResolucion = fechaInicioPlazoResolucion(expediente);
        if (fechaRequerimiento.isBefore(inicioResolucion)) {
            throw new IllegalArgumentException("El requerimiento de descargos no puede registrarse antes de la admisión válida");
        }

        LocalDate fechaLimite = DiasHabilesUtil.sumarDiasHabiles(fechaRequerimiento, 7);
        String actor = normalizarActor(request.responsableTtaip(), "TTAIP");

        DescargoEntidadTtaip descargo = new DescargoEntidadTtaip();
        descargo.setExpediente(expediente);
        descargo.setApelacion(expediente.getApelacion());
        descargo.setEntidad(entidad);
        descargo.setFechaRequerimiento(fechaRequerimiento);
        descargo.setFechaLimiteDescargo(fechaLimite);
        descargo.setEstadoDescargo(DescargoEntidadTtaip.EstadoDescargo.REQUERIDO);
        descargo.setObservacion(request.observacion());
        descargo.setTrazabilidad("%s - Requerimiento de descargos a %s. Límite: %s."
                .formatted(LocalDateTime.now(), entidad.getNombre(), fechaLimite));
        DescargoEntidadTtaip savedDescargo = descargoRepository.save(descargo);

        SuspensionPlazoTtaip suspension = new SuspensionPlazoTtaip();
        suspension.setExpediente(expediente);
        suspension.setDescargo(savedDescargo);
        suspension.setMotivoSuspension(SuspensionPlazoTtaip.MotivoSuspension.DESCARGOS_ENTIDAD);
        suspension.setSolicitante(SuspensionPlazoTtaip.SolicitanteSuspension.TTAIP);
        suspension.setMotivoDetalle("Requerimiento de descargos y expediente administrativo a la entidad pública");
        suspension.setFechaSolicitud(fechaRequerimiento);
        suspension.setFechaInicioSuspension(fechaRequerimiento);
        suspension.setFechaFinSuspension(fechaLimite);
        suspension.setDiasSuspendidos(7);
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.ACTIVA);
        suspension.setResponsable(actor);
        suspension.setObservacion(request.observacion());
        suspension.setTrazabilidad("%s - Suspensión activa por descargos de entidad; periodo %s a %s."
                .formatted(LocalDateTime.now(), fechaRequerimiento, fechaLimite));
        suspensionRepository.save(suspension);

        recalcularFechaLimiteResolucion(expediente);
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - Descargos requeridos a %s; plazo suspendido por 7 días hábiles hasta %s."
                        .formatted(LocalDateTime.now(), entidad.getNombre(), fechaLimite)
        ));
        expedienteRepository.save(expediente);

        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.DESCARGO_REQUERIDO,
                "Descargos requeridos a la entidad pública. Fecha límite: " + fechaLimite,
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                actor,
                "DESCARGO-" + savedDescargo.getId()
        );
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.SUSPENSION_PLAZO,
                "Plazo de resolución suspendido por descargos de entidad. Nueva fecha límite: "
                        + expediente.getFechaLimiteResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                actor,
                "SUSPENSION-DESCARGO-" + savedDescargo.getId()
        );

        return savedDescargo;
    }

    @Transactional
    public DescargoEntidadTtaip presentarDescargo(Long expedienteId,
                                                  Long descargoId,
                                                  PresentarDescargoEntidadRequest request) {
        ExpedienteTtaip expediente = buscarExpediente(expedienteId);
        DescargoEntidadTtaip descargo = buscarDescargo(descargoId);
        validarDescargoDelExpediente(expedienteId, descargo);

        if (descargo.getEstadoDescargo() != DescargoEntidadTtaip.EstadoDescargo.REQUERIDO) {
            throw new IllegalArgumentException("El descargo no está activo para presentación");
        }

        LocalDate fechaPresentacion = request.fechaPresentacion() != null
                ? request.fechaPresentacion()
                : LocalDate.now();
        if (fechaPresentacion.isBefore(descargo.getFechaRequerimiento())) {
            throw new IllegalArgumentException("La fecha de presentación no puede ser anterior al requerimiento");
        }

        boolean extemporaneo = fechaPresentacion.isAfter(descargo.getFechaLimiteDescargo());
        descargo.setFechaPresentacion(fechaPresentacion);
        descargo.setResumenDescargo(request.resumenDescargo());
        descargo.setDocumentoDescargo(request.referenciaDocumento());
        descargo.setResponsableEntidad(request.responsableEntidad());
        descargo.setObservacion(request.observacion());
        descargo.setEstadoDescargo(extemporaneo
                ? DescargoEntidadTtaip.EstadoDescargo.PRESENTADO_EXTEMPORANEO
                : DescargoEntidadTtaip.EstadoDescargo.PRESENTADO);
        descargo.setTrazabilidad(agregarTraza(
                descargo.getTrazabilidad(),
                "%s - Descargo presentado por %s%s."
                        .formatted(
                                LocalDateTime.now(),
                                request.responsableEntidad(),
                                extemporaneo ? " fuera del plazo legal" : "")
        ));
        DescargoEntidadTtaip savedDescargo = descargoRepository.save(descargo);

        cerrarSuspensionPorDescargo(expediente, savedDescargo, fechaPresentacion, extemporaneo);
        recalcularFechaLimiteResolucion(expediente);
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - Descargo de entidad presentado%s. Fecha límite de resolución recalculada: %s."
                        .formatted(
                                LocalDateTime.now(),
                                extemporaneo ? " fuera de plazo" : "",
                                expediente.getFechaLimiteResolucion())
        ));
        expedienteRepository.save(expediente);

        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.DESCARGO_PRESENTADO,
                extemporaneo
                        ? "Descargo presentado fuera del plazo de 7 días hábiles."
                        : "Descargo presentado dentro del plazo de 7 días hábiles.",
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                normalizarActor(request.responsableEntidad(), "Entidad pública"),
                "DESCARGO-" + savedDescargo.getId()
        );

        return savedDescargo;
    }

    @Transactional
    public List<DescargoEntidadTtaip> procesarDescargosVencidos() {
        List<DescargoEntidadTtaip> vencidos = descargoRepository.findByEstadoDescargoInAndFechaLimiteDescargoBefore(
                estadosDescargoActivos(),
                LocalDate.now()
        );

        for (DescargoEntidadTtaip descargo : vencidos) {
            ExpedienteTtaip expediente = descargo.getExpediente();
            descargo.setEstadoDescargo(DescargoEntidadTtaip.EstadoDescargo.VENCIDO_SIN_PRESENTACION);
            descargo.setTrazabilidad(agregarTraza(
                    descargo.getTrazabilidad(),
                    "%s - Descargo vencido sin presentación dentro del plazo de 7 días hábiles."
                            .formatted(LocalDateTime.now())
            ));

            cerrarSuspensionVencida(expediente, descargo);
            recalcularFechaLimiteResolucion(expediente);
            expediente.setTrazabilidadMinima(agregarTraza(
                    expediente.getTrazabilidadMinima(),
                    "%s - Descargo vencido sin presentación; el expediente continúa su trámite. Fecha límite de resolución: %s."
                            .formatted(LocalDateTime.now(), expediente.getFechaLimiteResolucion())
            ));
            expedienteRepository.save(expediente);

            registrarHistorial(
                    expediente,
                    HistorialTtaip.TipoEvento.DESCARGO_PRESENTADO,
                    "Descargo vencido sin presentación. El expediente puede continuar.",
                    null,
                    expediente.getEstado() != null ? expediente.getEstado().name() : null,
                    "SISTEMA",
                    "DESCARGO-VENCIDO-" + descargo.getId()
            );
        }

        return descargoRepository.saveAll(vencidos);
    }

    @Transactional(readOnly = true)
    public List<SuspensionPlazoTtaip> listarSuspensiones(Long expedienteId) {
        return suspensionRepository.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(expedienteId);
    }

    @Transactional
    public SuspensionPlazoTtaip registrarSuspensionPorInformeOral(Long expedienteId,
                                                                  RegistrarSuspensionTtaipRequest request) {
        return registrarSuspensionAdicional(
                expedienteId,
                SuspensionPlazoTtaip.MotivoSuspension.INFORME_ORAL,
                request);
    }

    @Transactional
    public SuspensionPlazoTtaip registrarSuspensionPorInformacionComplementaria(Long expedienteId,
                                                                               RegistrarSuspensionTtaipRequest request) {
        return registrarSuspensionAdicional(
                expedienteId,
                SuspensionPlazoTtaip.MotivoSuspension.INFORMACION_COMPLEMENTARIA,
                request);
    }

    @Transactional
    public SuspensionPlazoTtaip cancelarSuspension(Long expedienteId,
                                                  Long suspensionId,
                                                  CancelarSuspensionTtaipRequest request) {
        ExpedienteTtaip expediente = buscarExpediente(expedienteId);
        validarExpedienteAdmitido(expediente);
        SuspensionPlazoTtaip suspension = buscarSuspension(suspensionId);
        validarSuspensionDelExpediente(expedienteId, suspension);

        if (suspension.getEstadoSuspension() != SuspensionPlazoTtaip.EstadoSuspension.ACTIVA) {
            throw new IllegalArgumentException("Solo se puede cancelar una suspensión activa");
        }
        if (suspension.getMotivoSuspension() == SuspensionPlazoTtaip.MotivoSuspension.DESCARGOS_ENTIDAD) {
            throw new IllegalArgumentException("La suspensión por descargos se cierra con la presentación o vencimiento del descargo");
        }

        LocalDate fechaCancelacion = request.fechaCancelacion() != null
                ? request.fechaCancelacion()
                : LocalDate.now();
        if (fechaCancelacion.isBefore(suspension.getFechaInicioSuspension())) {
            throw new IllegalArgumentException("La fecha de cancelación no puede ser anterior al inicio de suspensión");
        }

        String actor = normalizarActor(request.responsable(), "TTAIP");
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.CANCELADA);
        suspension.setFechaFinSuspension(fechaCancelacion);
        suspension.setDiasSuspendidos(0);
        suspension.setResponsable(actor);
        suspension.setObservacion(request.observacion());
        suspension.setTrazabilidad(agregarTraza(
                suspension.getTrazabilidad(),
                "%s - Suspensión %s cancelada por %s. No suma días al plazo de resolución."
                        .formatted(LocalDateTime.now(), suspension.getMotivoSuspension(), actor)
        ));
        SuspensionPlazoTtaip saved = suspensionRepository.save(suspension);

        recalcularFechaLimiteResolucion(expediente);
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - Suspensión %s cancelada. Fecha límite de resolución recalculada: %s."
                        .formatted(LocalDateTime.now(), suspension.getMotivoSuspension(), expediente.getFechaLimiteResolucion())
        ));
        expedienteRepository.save(expediente);
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.SUSPENSION_PLAZO,
                "Suspensión " + suspension.getMotivoSuspension() + " cancelada. Nueva fecha límite: "
                        + expediente.getFechaLimiteResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                actor,
                "SUSPENSION-CANCELADA-" + saved.getId()
        );

        return saved;
    }

    private ExpedienteTtaip crearExpediente(Apelacion apelacion) {
        SalaTtaip sala = seleccionarSala();
        ExpedienteTtaip expediente = new ExpedienteTtaip();
        expediente.setNumeroExpediente(apelacion.getExpediente());
        expediente.setApelacion(apelacion);
        expediente.setSala(sala);
        expediente.setEstado(apelacion.getEstado());
        expediente.setFechaApertura(LocalDateTime.now());
        expediente.setTrazabilidadMinima(agregarTraza(null, LocalDateTime.now() + " - Expediente TTAIP abierto sin etapa de elevación"));
        expediente.setMiembrosAsignados(new LinkedHashSet<>(miembroService.obtenerMiembrosTTAIPActivosPorSala(sala.getNombre())));
        ExpedienteTtaip saved = expedienteRepository.save(expediente);
        registrarHistorial(
                saved,
                HistorialTtaip.TipoEvento.APERTURA_EXPEDIENTE,
                "Expediente TTAIP abierto sin etapa de elevación; sala asignada: " + sala.getNombre(),
                null,
                saved.getEstado() != null ? saved.getEstado().name() : null,
                "SISTEMA",
                saved.getNumeroExpediente()
        );
        apelacion.setExpedienteTtaip(saved);
        return saved;
    }

    private ExpedienteTtaip buscarExpediente(Long expedienteId) {
        return expedienteRepository.findById(expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Expediente TTAIP no encontrado con ID: " + expedienteId));
    }

    private NotificacionTtaip buscarNotificacion(Long expedienteId, Long notificacionId) {
        buscarExpediente(expedienteId);
        return notificacionRepository
                .findByIdNotificacionAndExpediente_IdExpedienteTtaip(notificacionId, expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Notificación TTAIP no encontrada con ID: " + notificacionId
                                + " para el expediente TTAIP ID: " + expedienteId));
    }

    private DescargoEntidadTtaip buscarDescargo(Long descargoId) {
        return descargoRepository.findById(descargoId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Descargo de entidad no encontrado con ID: " + descargoId));
    }

    private SuspensionPlazoTtaip buscarSuspension(Long suspensionId) {
        return suspensionRepository.findById(suspensionId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Suspensión de plazo TTAIP no encontrada con ID: " + suspensionId));
    }

    private void validarDescargoDelExpediente(Long expedienteId, DescargoEntidadTtaip descargo) {
        if (descargo.getExpediente() == null || !expedienteId.equals(descargo.getExpediente().getId())) {
            throw new IllegalArgumentException("El descargo no pertenece al expediente TTAIP indicado");
        }
    }

    private void validarSuspensionDelExpediente(Long expedienteId, SuspensionPlazoTtaip suspension) {
        if (suspension.getExpediente() == null || !expedienteId.equals(suspension.getExpediente().getId())) {
            throw new IllegalArgumentException("La suspensión no pertenece al expediente TTAIP indicado");
        }
    }

    private void validarExpedienteAdmitido(ExpedienteTtaip expediente) {
        if (expediente.getEstado() != Apelacion.EstadoApelacion.EN_RESOLUCION) {
            throw new IllegalArgumentException("Solo se pueden registrar actuaciones con suspensión después de una admisión válida");
        }
    }

    private SuspensionPlazoTtaip registrarSuspensionAdicional(Long expedienteId,
                                                              SuspensionPlazoTtaip.MotivoSuspension motivoSuspension,
                                                              RegistrarSuspensionTtaipRequest request) {
        ExpedienteTtaip expediente = buscarExpediente(expedienteId);
        validarExpedienteAdmitido(expediente);

        if (suspensionRepository.existsByExpediente_IdExpedienteTtaipAndMotivoSuspensionAndEstadoSuspension(
                expedienteId,
                motivoSuspension,
                SuspensionPlazoTtaip.EstadoSuspension.ACTIVA)) {
            throw new IllegalArgumentException("Ya existe una suspensión activa de tipo " + motivoSuspension + " para este expediente TTAIP");
        }

        LocalDate fechaSolicitud = request.fechaSolicitud() != null
                ? request.fechaSolicitud()
                : LocalDate.now();
        LocalDate inicioResolucion = fechaInicioPlazoResolucion(expediente);
        if (fechaSolicitud.isBefore(inicioResolucion)) {
            throw new IllegalArgumentException("La suspensión no puede registrarse antes del inicio del plazo de resolución");
        }

        LocalDate fechaFin = DiasHabilesUtil.sumarDiasHabiles(fechaSolicitud, DIAS_SUSPENSION_ADICIONAL);
        String actor = normalizarActor(request.responsable(), "TTAIP");
        SuspensionPlazoTtaip.SolicitanteSuspension solicitante = parseSolicitanteSuspension(request.solicitante());

        SuspensionPlazoTtaip suspension = new SuspensionPlazoTtaip();
        suspension.setExpediente(expediente);
        suspension.setMotivoSuspension(motivoSuspension);
        suspension.setSolicitante(solicitante);
        suspension.setMotivoDetalle(request.motivo());
        suspension.setFechaSolicitud(fechaSolicitud);
        suspension.setFechaInicioSuspension(fechaSolicitud);
        suspension.setFechaFinSuspension(fechaFin);
        suspension.setDiasSuspendidos(DIAS_SUSPENSION_ADICIONAL);
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.ACTIVA);
        suspension.setResponsable(actor);
        suspension.setObservacion(request.observacion());
        suspension.setTrazabilidad("%s - Suspensión %s solicitada por %s; periodo %s a %s; %d días hábiles."
                .formatted(
                        LocalDateTime.now(),
                        motivoSuspension,
                        solicitante,
                        fechaSolicitud,
                        fechaFin,
                        DIAS_SUSPENSION_ADICIONAL));
        SuspensionPlazoTtaip saved = suspensionRepository.save(suspension);

        recalcularFechaLimiteResolucion(expediente);
        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - Suspensión %s registrada por %d días hábiles. Fecha límite de resolución recalculada: %s."
                        .formatted(
                                LocalDateTime.now(),
                                motivoSuspension,
                                DIAS_SUSPENSION_ADICIONAL,
                                expediente.getFechaLimiteResolucion())
        ));
        expedienteRepository.save(expediente);

        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.SUSPENSION_PLAZO,
                "Suspensión " + motivoSuspension + " registrada por "
                        + DIAS_SUSPENSION_ADICIONAL + " días hábiles. Nueva fecha límite: "
                        + expediente.getFechaLimiteResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                actor,
                "SUSPENSION-" + motivoSuspension + "-" + saved.getId()
        );

        return saved;
    }

    private SuspensionPlazoTtaip.SolicitanteSuspension parseSolicitanteSuspension(String solicitante) {
        try {
            return SuspensionPlazoTtaip.SolicitanteSuspension.valueOf(solicitante.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "Solicitante de suspensión no válido: " + solicitante
                    + ". Valores permitidos: CIUDADANO, ENTIDAD_PUBLICA, TTAIP");
        }
    }

    private Entidad entidadRequerida(ExpedienteTtaip expediente) {
        if (expediente.getApelacion() == null
                || expediente.getApelacion().getSolicitud() == null
                || expediente.getApelacion().getSolicitud().getEntidad() == null) {
            throw new IllegalStateException("El expediente TTAIP debe estar vinculado a una entidad pública");
        }
        return expediente.getApelacion().getSolicitud().getEntidad();
    }

    private List<DescargoEntidadTtaip.EstadoDescargo> estadosDescargoActivos() {
        return List.of(DescargoEntidadTtaip.EstadoDescargo.REQUERIDO);
    }

    private String normalizarActor(String actor, String fallback) {
        return actor != null && !actor.isBlank() ? actor.trim() : fallback;
    }

    private String normalizarTexto(String value, String fallback) {
        return value != null && !value.isBlank() ? value.trim().toUpperCase() : fallback;
    }

    private String normalizarNullable(String value) {
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private String normalizarEstadoAcuse(String estadoAcuse) {
        String normalized = normalizarTexto(estadoAcuse, "");
        return switch (normalized) {
            case "ENTREGADO", "FALLIDO", "NO_RECIBIDO", "OBSERVADO" -> normalized;
            default -> throw new IllegalArgumentException(
                    "Estado de acuse no válido: " + estadoAcuse
                            + ". Valores permitidos: ENTREGADO, FALLIDO, NO_RECIBIDO, OBSERVADO");
        };
    }

    private String estadoDesdeAcuse(String estadoAcuse) {
        return switch (estadoAcuse) {
            case "ENTREGADO" -> "ENTREGADA";
            case "OBSERVADO" -> "OBSERVADA";
            case "FALLIDO", "NO_RECIBIDO" -> "FALLIDA";
            default -> "PENDIENTE";
        };
    }

    private void actualizarEvidencia(NotificacionTtaip notificacion, String evidenciaUrl, String referenciaEvidencia) {
        String evidencia = normalizarNullable(evidenciaUrl);
        String referencia = normalizarNullable(referenciaEvidencia);
        if (evidencia != null) {
            notificacion.setEvidenciaUrl(evidencia);
        }
        if (referencia != null) {
            notificacion.setReferenciaEvidencia(referencia);
        }
    }

    private void validarSustentoManual(NotificacionTtaip notificacion, ValidarNotificacionManualRequest request) {
        boolean notificacionDefectuosa = esEstadoDefectuoso(notificacion.getEstado())
                || esEstadoAcuseDefectuoso(notificacion.getEstadoAcuse());
        boolean tieneSustento = !request.observacionValidacion().isBlank()
                || normalizarNullable(request.evidenciaUrl()) != null
                || normalizarNullable(request.referenciaEvidencia()) != null
                || normalizarNullable(notificacion.getConstanciaEnvio()) != null
                || normalizarNullable(notificacion.getAcuseAutomatico()) != null;

        if (notificacionDefectuosa && !tieneSustento) {
            throw new IllegalArgumentException(
                    "No se puede validar manualmente una notificación fallida u observada sin sustento");
        }
    }

    private boolean esEstadoDefectuoso(String estado) {
        String normalized = estado == null ? "" : estado.trim().toUpperCase();
        return normalized.equals("FALLIDA") || normalized.equals("OBSERVADA");
    }

    private boolean esEstadoAcuseDefectuoso(String estadoAcuse) {
        String normalized = estadoAcuse == null ? "" : estadoAcuse.trim().toUpperCase();
        return normalized.equals("FALLIDO") || normalized.equals("NO_RECIBIDO") || normalized.equals("OBSERVADO");
    }

    private String valorTraza(String value) {
        return value == null || value.isBlank() ? "sin-codigo" : value;
    }

    private void cerrarSuspensionPorDescargo(ExpedienteTtaip expediente,
                                             DescargoEntidadTtaip descargo,
                                             LocalDate fechaPresentacion,
                                             boolean extemporaneo) {
        suspensionRepository.findFirstByDescargo_IdDescargoOrderByFechaCreacionDesc(descargo.getId())
                .ifPresent(suspension -> {
                    LocalDate fechaFin = extemporaneo
                            ? descargo.getFechaLimiteDescargo()
                            : fechaPresentacion;
                    suspension.setFechaFinSuspension(fechaFin);
                    suspension.setDiasSuspendidos(calcularDiasSuspendidos(
                            suspension.getFechaInicioSuspension(),
                            fechaFin));
                    suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.CERRADA);
                    suspension.setTrazabilidad(agregarTraza(
                            suspension.getTrazabilidad(),
                            "%s - Suspensión cerrada por presentación de descargo%s. Días suspendidos: %d."
                                    .formatted(
                                            LocalDateTime.now(),
                                            extemporaneo ? " fuera de plazo" : "",
                                            suspension.getDiasSuspendidos())
                    ));
                    suspensionRepository.save(suspension);
                    registrarHistorial(
                            expediente,
                            HistorialTtaip.TipoEvento.SUSPENSION_PLAZO,
                            "Suspensión por descargos cerrada. Días suspendidos: " + suspension.getDiasSuspendidos(),
                            null,
                            expediente.getEstado() != null ? expediente.getEstado().name() : null,
                            normalizarActor(descargo.getResponsableEntidad(), "Entidad pública"),
                            "SUSPENSION-CERRADA-DESCARGO-" + descargo.getId()
                    );
                });
    }

    private void cerrarSuspensionVencida(ExpedienteTtaip expediente, DescargoEntidadTtaip descargo) {
        suspensionRepository.findFirstByDescargo_IdDescargoOrderByFechaCreacionDesc(descargo.getId())
                .ifPresent(suspension -> {
                    suspension.setFechaFinSuspension(descargo.getFechaLimiteDescargo());
                    suspension.setDiasSuspendidos(calcularDiasSuspendidos(
                            suspension.getFechaInicioSuspension(),
                            descargo.getFechaLimiteDescargo()));
                    suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.VENCIDA);
                    suspension.setTrazabilidad(agregarTraza(
                            suspension.getTrazabilidad(),
                            "%s - Suspensión cerrada por vencimiento sin descargo. Días suspendidos: %d."
                                    .formatted(LocalDateTime.now(), suspension.getDiasSuspendidos())
                    ));
                    suspensionRepository.save(suspension);
                    registrarHistorial(
                            expediente,
                            HistorialTtaip.TipoEvento.SUSPENSION_PLAZO,
                            "Suspensión por descargos vencida sin presentación. Días suspendidos: "
                                    + suspension.getDiasSuspendidos(),
                            null,
                            expediente.getEstado() != null ? expediente.getEstado().name() : null,
                            "SISTEMA",
                            "SUSPENSION-VENCIDA-DESCARGO-" + descargo.getId()
                    );
                });
    }

    private int calcularDiasSuspendidos(LocalDate fechaInicio, LocalDate fechaFin) {
        if (fechaInicio == null || fechaFin == null || !fechaFin.isAfter(fechaInicio)) {
            return 0;
        }
        return Math.max(0, DiasHabilesUtil.contarDiasHabiles(fechaInicio.plusDays(1), fechaFin));
    }

    private void recalcularFechaLimiteResolucion(ExpedienteTtaip expediente) {
        LocalDate inicio = fechaInicioPlazoResolucion(expediente);
        LocalDate base = DiasHabilesUtil.sumarDiasHabiles(inicio, 10);
        int totalDiasSuspendidos = suspensionRepository
                .findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(expediente.getId())
                .stream()
                .mapToInt(suspension -> suspension.getDiasSuspendidos() != null ? suspension.getDiasSuspendidos() : 0)
                .sum();
        expediente.setFechaLimiteResolucion(DiasHabilesUtil.sumarDiasHabiles(base, totalDiasSuspendidos));
    }

    private LocalDate fechaInicioPlazoResolucion(ExpedienteTtaip expediente) {
        if (expediente.getFechaSegundaCalificacion() != null) {
            return expediente.getFechaSegundaCalificacion().toLocalDate();
        }
        if (expediente.getFechaPrimeraCalificacion() != null) {
            return expediente.getFechaPrimeraCalificacion().toLocalDate();
        }
        if (expediente.getFechaApertura() != null) {
            return expediente.getFechaApertura().toLocalDate();
        }
        return LocalDate.now();
    }

    private ExpedienteTtaip sincronizarEstado(ExpedienteTtaip expediente, Apelacion apelacion) {
        if (apelacion.getEstado() != null && apelacion.getEstado() != expediente.getEstado()) {
            String estadoAnterior = expediente.getEstado() != null ? expediente.getEstado().name() : null;
            expediente.setEstado(apelacion.getEstado());
            expedienteRepository.save(expediente);
            registrarHistorial(
                    expediente,
                    HistorialTtaip.TipoEvento.CAMBIO_ESTADO,
                    "Estado del expediente actualizado desde la apelación asociada.",
                    estadoAnterior,
                    apelacion.getEstado().name(),
                    "SISTEMA",
                    expediente.getNumeroExpediente()
            );
        }
        apelacion.setExpedienteTtaip(expediente);
        return expediente;
    }

    private SalaTtaip seleccionarSala() {
        List<SalaTtaip> salas = salaRepository.findByActivaTrueOrderByNombreAsc();
        if (salas.isEmpty()) {
            return crearSalaMinima(PRIMERA_SALA, LocalDate.of(LocalDate.now().getYear(), 3, 22), LocalDate.of(LocalDate.now().getYear() + 1, 3, 21));
        }

        SalaTtaip primera = salaRepository.findByNombre(PRIMERA_SALA).orElse(salas.get(0));
        SalaTtaip segunda = salaRepository.findByNombre(SEGUNDA_SALA).orElse(null);
        if (segunda == null) {
            return primera;
        }

        long expedientesPrimera = expedienteRepository.countBySala_Nombre(PRIMERA_SALA);
        long expedientesSegunda = expedienteRepository.countBySala_Nombre(SEGUNDA_SALA);
        return expedientesPrimera <= expedientesSegunda ? primera : segunda;
    }

    private SalaTtaip crearSalaMinima(String nombre, LocalDate inicio, LocalDate fin) {
        SalaTtaip sala = new SalaTtaip();
        sala.setNombre(nombre);
        sala.setPeriodoInicio(inicio);
        sala.setPeriodoFin(fin);
        sala.setActiva(true);
        return salaRepository.save(sala);
    }

    private String generarNumeroResolucion(ExpedienteTtaip expediente) {
        int year = LocalDate.now().getYear();
        long sequence = RESOLUCION_BASE + resolucionRepository.countByNumeroResolucionContaining("-" + year + "-JUS/TTAIP") + 1;
        return "RESOLUCIÓN N.° %06d-%d-JUS/TTAIP-%s".formatted(sequence, year, expediente.getSala().getNombre());
    }

    private String obtenerNumeroCedulaParaResolucion(Resolucion resolucion) {
        return cedulaRepository.findFirstByResolucion_IdResolucionOrderByIdCedulaAsc(resolucion.getId())
                .map(CedulaNotificacion::getNumeroCedula)
                .orElseGet(this::generarSiguienteNumeroCedula);
    }

    private String generarSiguienteNumeroCedula() {
        int year = LocalDate.now().getYear();
        String suffix = "-" + year + "-JUS/TTAIP";
        int sequence = cedulaRepository.findByNumeroCedulaEndingWith(suffix)
                .stream()
                .map(CedulaNotificacion::getNumeroCedula)
                .mapToInt(this::extraerSecuenciaCedula)
                .max()
                .orElse(CEDULA_BASE - 1) + 1;
        return "%05d-%d-JUS/TTAIP".formatted(sequence, year);
    }

    private int extraerSecuenciaCedula(String numeroCedula) {
        if (numeroCedula == null || numeroCedula.isBlank()) {
            return CEDULA_BASE - 1;
        }

        int separator = numeroCedula.indexOf('-');
        if (separator <= 0) {
            return CEDULA_BASE - 1;
        }

        try {
            return Integer.parseInt(numeroCedula.substring(0, separator));
        } catch (NumberFormatException e) {
            return CEDULA_BASE - 1;
        }
    }

    private void crearCedulaYNotificacionSiFalta(Resolucion resolucion,
                                                 ExpedienteTtaip expediente,
                                                 CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (cedulaRepository.existsByResolucion_IdResolucionAndDestinatario(resolucion.getId(), destinatario)) {
            return;
        }

        String numeroCedula = obtenerNumeroCedulaParaResolucion(resolucion);
        CedulaNotificacion cedula = new CedulaNotificacion();
        cedula.setResolucion(resolucion);
        cedula.setNumeroCedula(numeroCedula);
        cedula.setDestinatario(destinatario);
        cedula.setDestinatarioNombre(resolveNombreDestinatario(expediente, destinatario));
        cedula.setDestinatarioEmail(resolveEmailDestinatario(expediente, destinatario));
        cedula.setDocumentoReferencia("CÉDULA DE NOTIFICACIÓN N.° " + numeroCedula);
        CedulaNotificacion savedCedula = cedulaRepository.save(cedula);
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.CEDULA_EMITIDA,
                "Cédula emitida para " + etiquetaDestinatario(destinatario) + " por " + resolucion.getNumeroResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                "TTAIP",
                savedCedula.getNumeroCedula() + ":" + destinatario.name()
        );

        if (!notificacionRepository.existsByCedula_IdCedula(savedCedula.getId())) {
            NotificacionTtaip notificacion = new NotificacionTtaip();
            notificacion.setExpediente(expediente);
            notificacion.setCedula(savedCedula);
            notificacion.setDestinatario(destinatario);
            notificacion.setDestinatarioNombre(savedCedula.getDestinatarioNombre());
            notificacion.setDestinatarioEmail(savedCedula.getDestinatarioEmail());
            notificacion.setMedio(savedCedula.getCanal());
            notificacion.setMedioNotificacion(savedCedula.getCanal());
            notificacion.setEstado("PENDIENTE");
            notificacion.setResultadoNotificacion("PENDIENTE_CONSTANCIA");
            notificacion.setDetalle("Notificación de " + resolucion.getNumeroResolucion());
            NotificacionTtaip savedNotificacion = notificacionRepository.save(notificacion);
            registrarHistorial(
                    expediente,
                    HistorialTtaip.TipoEvento.NOTIFICACION_REGISTRADA,
                    "Notificación registrada para " + etiquetaDestinatario(destinatario),
                    null,
                    expediente.getEstado() != null ? expediente.getEstado().name() : null,
                    "TTAIP",
                    "NOTIFICACION-" + savedCedula.getNumeroCedula() + ":" + savedNotificacion.getDestinatario().name()
            );
        }
    }

    private ReprocesoNotificacion reprocesarNotificacionFallida(NotificacionTtaip notificacionOriginal,
                                                                 String observacion,
                                                                 String responsable) {
        CedulaNotificacion cedulaOriginal = notificacionOriginal.getCedula();
        if (cedulaOriginal == null || cedulaOriginal.getResolucion() == null) {
            throw new IllegalStateException("La notificación original debe estar vinculada a una cédula y resolución");
        }

        ExpedienteTtaip expediente = notificacionOriginal.getExpediente();
        Resolucion resolucion = cedulaOriginal.getResolucion();
        CedulaNotificacion.DestinatarioNotificacion destinatario = cedulaOriginal.getDestinatario();
        String responsableNormalizado = responsable != null && !responsable.isBlank() ? responsable.trim() : "TTAIP";

        notificacionOriginal.setEstado("FALLIDA");
        notificacionOriginal.setEstadoAcuse("FALLIDO");
        notificacionOriginal.setResultadoNotificacion("REPROCESO_REQUERIDO");
        notificacionOriginal.setDetalle(agregarTraza(
                notificacionOriginal.getDetalle(),
                "Reproceso registrado por notificación fallida: " + observacion
        ));
        notificacionOriginal.setTrazabilidad(agregarTraza(
                notificacionOriginal.getTrazabilidad(),
                "%s - Notificación marcada como FALLIDA por reproceso; responsable=%s; observación=%s".formatted(
                        LocalDateTime.now(),
                        responsableNormalizado,
                        observacion
                )
        ));
        notificacionRepository.save(notificacionOriginal);

        CedulaNotificacion nuevaCedula = new CedulaNotificacion();
        nuevaCedula.setResolucion(resolucion);
        nuevaCedula.setNumeroCedula(generarSiguienteNumeroCedula());
        nuevaCedula.setDestinatario(destinatario);
        nuevaCedula.setDestinatarioNombre(cedulaOriginal.getDestinatarioNombre());
        nuevaCedula.setDestinatarioEmail(cedulaOriginal.getDestinatarioEmail());
        nuevaCedula.setCanal(cedulaOriginal.getCanal());
        nuevaCedula.setEstado("EMITIDA_REPROCESO");
        nuevaCedula.setDocumentoReferencia("CÉDULA DE NOTIFICACIÓN N.° " + nuevaCedula.getNumeroCedula());
        CedulaNotificacion savedCedula = cedulaRepository.save(nuevaCedula);

        NotificacionTtaip nuevaNotificacion = new NotificacionTtaip();
        nuevaNotificacion.setExpediente(expediente);
        nuevaNotificacion.setCedula(savedCedula);
        nuevaNotificacion.setDestinatario(destinatario);
        nuevaNotificacion.setDestinatarioNombre(savedCedula.getDestinatarioNombre());
        nuevaNotificacion.setDestinatarioEmail(savedCedula.getDestinatarioEmail());
        nuevaNotificacion.setMedio(notificacionOriginal.getMedio());
        nuevaNotificacion.setMedioNotificacion(normalizarNullable(notificacionOriginal.getMedioNotificacion()) != null
                ? notificacionOriginal.getMedioNotificacion()
                : notificacionOriginal.getMedio());
        nuevaNotificacion.setEstado("PENDIENTE");
        nuevaNotificacion.setResultadoNotificacion("PENDIENTE_CONSTANCIA_REPROCESO");
        nuevaNotificacion.setDetalle("Reproceso de notificación fallida de la cédula "
                + cedulaOriginal.getNumeroCedula() + ". " + observacion);
        nuevaNotificacion.setTrazabilidad("%s - Nueva notificación generada por reproceso de la cédula original %s."
                .formatted(LocalDateTime.now(), cedulaOriginal.getNumeroCedula()));
        NotificacionTtaip savedNotificacion = notificacionRepository.save(nuevaNotificacion);

        int numeroIntento = (int) reprocesoRepository.countByCedulaOriginal_IdCedulaAndDestinatario(
                cedulaOriginal.getId(),
                destinatario
        ) + 1;

        ReprocesoNotificacion reproceso = new ReprocesoNotificacion();
        reproceso.setExpediente(expediente);
        reproceso.setNotificacion(notificacionOriginal);
        reproceso.setCedulaOriginal(cedulaOriginal);
        reproceso.setCedulaNueva(savedCedula);
        reproceso.setNotificacionNueva(savedNotificacion);
        reproceso.setDestinatario(destinatario);
        reproceso.setNumeroCedulaOriginal(cedulaOriginal.getNumeroCedula());
        reproceso.setFechaIngresoCargo(LocalDate.now());
        reproceso.setObservacionReproceso(observacion);
        reproceso.setFechaSubsanacion(LocalDate.now());
        reproceso.setCedulaSubsanacion(savedCedula.getNumeroCedula());
        reproceso.setFechaCedulaSubsanacion(LocalDate.now());
        reproceso.setNumeroIntento(numeroIntento);
        reproceso.setEstado(ReprocesoNotificacion.EstadoReproceso.ATENDIDO);
        reproceso.setResponsableNotificacion(responsableNormalizado);
        reproceso.setResponsableSubsanacion(responsableNormalizado);
        ReprocesoNotificacion savedReproceso = reprocesoRepository.save(reproceso);

        expediente.setTrazabilidadMinima(agregarTraza(
                expediente.getTrazabilidadMinima(),
                "%s - Reproceso de notificación para %s; cédula original %s, nueva cédula %s".formatted(
                        LocalDateTime.now(),
                        etiquetaDestinatario(destinatario),
                        cedulaOriginal.getNumeroCedula(),
                        savedCedula.getNumeroCedula()
                )
        ));
        expedienteRepository.save(expediente);

        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.CEDULA_EMITIDA,
                "Cédula de reproceso emitida para " + etiquetaDestinatario(destinatario)
                        + " por notificación fallida de " + resolucion.getNumeroResolucion(),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                responsableNormalizado,
                savedCedula.getNumeroCedula() + ":" + destinatario.name()
        );
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.NOTIFICACION_REGISTRADA,
                "Notificación de reproceso registrada para " + etiquetaDestinatario(destinatario),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                responsableNormalizado,
                "NOTIFICACION-" + savedCedula.getNumeroCedula() + ":" + destinatario.name()
        );
        registrarHistorial(
                expediente,
                HistorialTtaip.TipoEvento.REPROCESO_REGISTRADO,
                "Reproceso de notificación registrado para " + etiquetaDestinatario(destinatario),
                null,
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                responsableNormalizado,
                "REPROCESO-" + cedulaOriginal.getNumeroCedula() + ":" + destinatario.name() + ":" + numeroIntento
        );

        return savedReproceso;
    }

    private boolean debeNotificarEntidadPublica(Resolucion resolucion) {
        return resolucion.getDecision() != Resolucion.DecisionResolucion.INADMISIBLE;
    }

    private String resolveNombreDestinatario(ExpedienteTtaip expediente, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO) {
            return expediente.getApelacion().getCiudadano().getNombreCompleto();
        }
        return expediente.getApelacion().getSolicitud().getEntidad().getNombre();
    }

    private String resolveEmailDestinatario(ExpedienteTtaip expediente, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        if (destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO) {
            return expediente.getApelacion().getCiudadano().getEmail();
        }
        return expediente.getApelacion().getSolicitud().getEntidad().getEmail();
    }

    private String etiquetaDestinatario(CedulaNotificacion.DestinatarioNotificacion destinatario) {
        return destinatario == CedulaNotificacion.DestinatarioNotificacion.CIUDADANO
                ? "ciudadano"
                : "entidad pública";
    }

    private void actualizarFechasPorResolucion(ExpedienteTtaip expediente, Resolucion resolucion) {
        if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.PRIMERA_CALIFICACION) {
            expediente.setFechaPrimeraCalificacion(resolucion.getFechaResolucion());
            if (resolucion.getDecision() == Resolucion.DecisionResolucion.ADMISIBLE) {
                recalcularFechaLimiteResolucion(expediente);
            }
        } else if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.SEGUNDA_CALIFICACION) {
            expediente.setFechaSegundaCalificacion(resolucion.getFechaResolucion());
            if (resolucion.getDecision() == Resolucion.DecisionResolucion.ADMITIDO
                    || resolucion.getDecision() == Resolucion.DecisionResolucion.ADMISIBLE) {
                recalcularFechaLimiteResolucion(expediente);
            }
        } else if (resolucion.getTipoResolucion() == Resolucion.TipoResolucion.RESOLUCION_FINAL) {
            expediente.setFechaResolucionFinal(resolucion.getFechaResolucion());
        }
    }

    private String agregarTraza(String actual, String nuevaEntrada) {
        return actual == null || actual.isBlank()
                ? nuevaEntrada
                : actual + "\n" + nuevaEntrada;
    }

    private void registrarHistorial(ExpedienteTtaip expediente,
                                    HistorialTtaip.TipoEvento tipoEvento,
                                    String descripcion,
                                    String estadoAnterior,
                                    String estadoNuevo,
                                    String actor,
                                    String referencia) {
        boolean tieneReferenciaPersistible = referencia != null && expediente.getId() != null;
        if (tieneReferenciaPersistible && tipoEvento == HistorialTtaip.TipoEvento.CAMBIO_ESTADO) {
            if (historialRepository.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferenciaAndEstadoAnteriorAndEstadoNuevo(
                    expediente.getId(),
                    tipoEvento,
                    referencia,
                    estadoAnterior,
                    estadoNuevo
            )) {
                return;
            }
        } else if (tieneReferenciaPersistible && tipoEvento != HistorialTtaip.TipoEvento.AUDITORIA) {
            if (historialRepository.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferencia(
                    expediente.getId(),
                    tipoEvento,
                    referencia
            )) {
                return;
            }
        }

        HistorialTtaip historial = new HistorialTtaip();
        historial.setExpediente(expediente);
        historial.setTipoEvento(tipoEvento);
        historial.setDescripcion(descripcion);
        historial.setEstadoAnterior(estadoAnterior);
        historial.setEstadoNuevo(estadoNuevo);
        historial.setActor(actor);
        historial.setReferencia(referencia);
        historialRepository.save(historial);
    }
}
