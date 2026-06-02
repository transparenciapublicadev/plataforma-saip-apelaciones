package pe.gob.saip.backend.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ActualizarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.ActualizarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.ObservarSolicitudRequest;
import pe.gob.saip.backend.model.dto.RegistrarAmpliacionPlazoRequest;
import pe.gob.saip.backend.model.dto.RegistrarEncauzamientoSolicitudRequest;
import pe.gob.saip.backend.model.dto.RegistrarEntregaParcialRequest;
import pe.gob.saip.backend.model.dto.RegistrarLiquidacionCostoRequest;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;
import pe.gob.saip.backend.model.entity.EncauzamientoSolicitud;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.LiquidacionCostoSolicitud;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.AmpliacionPlazoSolicitudRepository;
import pe.gob.saip.backend.repository.CronogramaEntregaParcialSolicitudRepository;
import pe.gob.saip.backend.repository.EncauzamientoSolicitudRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.LiquidacionCostoSolicitudRepository;
import pe.gob.saip.backend.repository.ObservacionSolicitudRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class SolicitudService {

    private final SolicitudRepository solicitudRepository;
    private final ObservacionSolicitudRepository observacionRepository;
    private final AmpliacionPlazoSolicitudRepository ampliacionRepository;
    private final CronogramaEntregaParcialSolicitudRepository cronogramaRepository;
    private final EncauzamientoSolicitudRepository encauzamientoRepository;
    private final LiquidacionCostoSolicitudRepository liquidacionRepository;
    private final EntidadRepository entidadRepository;

    public SolicitudService(SolicitudRepository solicitudRepository,
                            ObservacionSolicitudRepository observacionRepository,
                            AmpliacionPlazoSolicitudRepository ampliacionRepository,
                            CronogramaEntregaParcialSolicitudRepository cronogramaRepository,
                            EncauzamientoSolicitudRepository encauzamientoRepository,
                            LiquidacionCostoSolicitudRepository liquidacionRepository,
                            EntidadRepository entidadRepository) {
        this.solicitudRepository = solicitudRepository;
        this.observacionRepository = observacionRepository;
        this.ampliacionRepository = ampliacionRepository;
        this.cronogramaRepository = cronogramaRepository;
        this.encauzamientoRepository = encauzamientoRepository;
        this.liquidacionRepository = liquidacionRepository;
        this.entidadRepository = entidadRepository;
    }

    @Transactional(readOnly = true)
    public List<Solicitud> obtenerTodasLasSolicitudes() {
        return solicitudRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Page<Solicitud> obtenerPagina(Pageable pageable) {
        return solicitudRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public Optional<Solicitud> obtenerSolicitudPorId(Long id) {
        return solicitudRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Solicitud> obtenerSolicitudPorExpediente(String expediente) {
        return solicitudRepository.findByExpediente(expediente);
    }

    @Transactional(readOnly = true)
    public List<Solicitud> findByCiudadanoId(Long ciudadanoId) {
        return solicitudRepository.findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(ciudadanoId);
    }

    @Transactional(readOnly = true)
    public Page<Solicitud> obtenerPaginaPorCiudadano(Long ciudadanoId, Pageable pageable) {
        return solicitudRepository.findByCiudadano_IdUsuario(ciudadanoId, pageable);
    }

    @Transactional(readOnly = true)
    public List<Solicitud> findByEntidadId(Long entidadId) {
        return solicitudRepository.findByEntidad_IdEntidadOrderByFechaPresentacionDesc(entidadId);
    }

    @Transactional(readOnly = true)
    public Page<Solicitud> obtenerPaginaPorEntidad(Long entidadId, Pageable pageable) {
        return solicitudRepository.findByEntidad_IdEntidad(entidadId, pageable);
    }

    @Transactional(readOnly = true)
    public List<Solicitud> obtenerSolicitudesPorEstado(Solicitud.EstadoSolicitud estado) {
        return solicitudRepository.findByEstado(estado);
    }

    @Transactional(readOnly = true)
    public Page<Solicitud> obtenerPaginaPorEstado(Solicitud.EstadoSolicitud estado, Pageable pageable) {
        return solicitudRepository.findByEstado(estado, pageable);
    }

    @Transactional(readOnly = true)
    public long contarSolicitudesPorEstado(Solicitud.EstadoSolicitud estado) {
        return solicitudRepository.countByEstado(estado);
    }

    @Transactional(readOnly = true)
    public long countByEntidadId(Long entidadId) {
        return solicitudRepository.countByEntidad_IdEntidad(entidadId);
    }

    @Transactional(readOnly = true)
    public long countByEntidadIdAndEstado(Long entidadId, String estado) {
        Solicitud.EstadoSolicitud estadoEnum = convertirEstado(estado);
        return solicitudRepository.countByEntidadAndEstado(entidadId, estadoEnum);
    }

    @Transactional(readOnly = true)
    public Optional<Solicitud> findByIdWithDetails(Long id) {
        return solicitudRepository.findByIdWithDetails(id);
    }

    @Transactional(readOnly = true)
    public Optional<Solicitud> findByExpediente(String expediente) {
        return solicitudRepository.findByExpediente(expediente);
    }

    @Transactional(readOnly = true)
    public Optional<Solicitud> findById(Long id) {
        return solicitudRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<ObservacionSolicitud> listarObservaciones(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return observacionRepository.findBySolicitud_IdSolicitudOrderByFechaObservacionDesc(solicitudId);
    }

    @Transactional(readOnly = true)
    public List<AmpliacionPlazoSolicitud> listarAmpliaciones(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return ampliacionRepository.findBySolicitud_IdSolicitudOrderByFechaSolicitudAmpliacionDesc(solicitudId);
    }

    @Transactional(readOnly = true)
    public List<CronogramaEntregaParcialSolicitud> listarCronogramaAmpliacion(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return cronogramaRepository.findByAmpliacion_Solicitud_IdSolicitudOrderByNumeroEntregaAsc(solicitudId);
    }

    @Transactional(readOnly = true)
    public List<EncauzamientoSolicitud> listarEncauzamientos(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return encauzamientoRepository.findBySolicitud_IdSolicitudOrderByFechaEncauzamientoDesc(solicitudId);
    }

    @Transactional(readOnly = true)
    public Optional<EncauzamientoSolicitud> obtenerEncauzamientoActivo(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return encauzamientoRepository.findFirstBySolicitud_IdSolicitudAndEstadoEncauzamientoInOrderByFechaEncauzamientoDesc(
                solicitudId,
                ESTADOS_ENCAUZAMIENTO_ACTIVO
        );
    }

    @Transactional(readOnly = true)
    public List<LiquidacionCostoSolicitud> listarLiquidaciones(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return liquidacionRepository.findBySolicitud_IdSolicitudOrderByFechaEmisionDesc(solicitudId);
    }

    @Transactional(readOnly = true)
    public Optional<LiquidacionCostoSolicitud> obtenerLiquidacionActiva(Long solicitudId) {
        validarSolicitudExiste(solicitudId);
        return liquidacionRepository.findFirstBySolicitud_IdSolicitudAndEstadoLiquidacionInOrderByFechaEmisionDesc(
                solicitudId,
                ESTADOS_LIQUIDACION_ACTIVA
        );
    }

    @Transactional
    public LiquidacionCostoSolicitud emitirLiquidacion(Long solicitudId, RegistrarLiquidacionCostoRequest request) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        validarPuedeEmitirLiquidacion(solicitud);
        validarSolicitudRequiereEntregaFisica(solicitud);
        validarSinLiquidacionActiva(solicitudId);

        LocalDate fechaNotificacion = request.fechaNotificacion();
        LocalDate fechaRecepcion = solicitud.getFechaPresentacion() != null
                ? solicitud.getFechaPresentacion().toLocalDate()
                : LocalDate.now();
        LocalDate fechaLimiteNotificacion = DiasHabilesUtil.sumarDiasHabiles(fechaRecepcion, 9);
        if (fechaNotificacion.isAfter(fechaLimiteNotificacion) || LocalDate.now().isAfter(fechaLimiteNotificacion)) {
            throw new IllegalArgumentException("La liquidación o cupón de pago debe notificarse como máximo hasta el día 9 de atención de la SAIP");
        }
        if (fechaNotificacion.isBefore(fechaRecepcion)) {
            throw new IllegalArgumentException("La fecha de notificación de la liquidación no puede ser anterior a la recepción de la SAIP");
        }

        String responsable = normalizarResponsable(request.responsable(), "Entidad pública");
        LocalDateTime ahora = LocalDateTime.now();
        LocalDate fechaLimiteRecojo = DiasHabilesUtil.sumarDiasHabiles(fechaNotificacion, 30);

        LiquidacionCostoSolicitud liquidacion = new LiquidacionCostoSolicitud();
        liquidacion.setSolicitud(solicitud);
        liquidacion.setCodigoLiquidacion(generarCodigoLiquidacion(solicitudId, request.codigoLiquidacion()));
        liquidacion.setMonto(normalizarMonto(request.monto()));
        liquidacion.setMoneda(normalizarMoneda(request.moneda()));
        liquidacion.setConcepto(request.concepto().trim());
        liquidacion.setFechaEmision(ahora);
        liquidacion.setFechaNotificacion(fechaNotificacion);
        liquidacion.setFechaLimiteRecojo(fechaLimiteRecojo);
        liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.NOTIFICADA);
        liquidacion.setMedioNotificacion(parseCanalNotificacion(request.medioNotificacion()));
        liquidacion.setResponsable(responsable);
        liquidacion.setObservacion(trimToNull(request.observacion()));
        liquidacion.setTrazabilidad("%s - Liquidación %s emitida y notificada por %s. Límite legal de notificación: %s; límite de recojo: %s."
                .formatted(ahora, liquidacion.getCodigoLiquidacion(), responsable, fechaLimiteNotificacion, fechaLimiteRecojo));

        return liquidacionRepository.save(liquidacion);
    }

    @Transactional
    public LiquidacionCostoSolicitud actualizarLiquidacion(Long solicitudId,
                                                           Long liquidacionId,
                                                           ActualizarLiquidacionCostoRequest request) {
        LiquidacionCostoSolicitud liquidacion = buscarLiquidacionDeSolicitud(solicitudId, liquidacionId);
        LiquidacionCostoSolicitud.EstadoLiquidacion nuevoEstado = parseEstadoLiquidacionOperativo(request.estado());
        validarLiquidacionNoCerrada(liquidacion);

        String responsable = normalizarResponsable(request.responsable(), "Entidad pública");
        LocalDate hoy = LocalDate.now();
        LocalDateTime ahora = LocalDateTime.now();

        switch (nuevoEstado) {
            case PAGADA -> {
                liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.PAGADA);
                liquidacion.setFechaPago(request.fechaPago() != null ? request.fechaPago() : hoy);
                liquidacion.setTrazabilidad(agregarTraza(
                        liquidacion.getTrazabilidad(),
                        "%s - Pago registrado por %s.".formatted(ahora, responsable)));
            }
            case RECOGIDA -> {
                liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.RECOGIDA);
                if (liquidacion.getFechaPago() == null && liquidacion.getMonto() != null
                        && liquidacion.getMonto().compareTo(BigDecimal.ZERO) > 0) {
                    liquidacion.setFechaPago(request.fechaPago() != null ? request.fechaPago() : hoy);
                }
                liquidacion.setFechaRecojo(request.fechaRecojo() != null ? request.fechaRecojo() : hoy);
                liquidacion.setTrazabilidad(agregarTraza(
                        liquidacion.getTrazabilidad(),
                        "%s - Información física recogida por el ciudadano; solicitud marcada como RESPONDIDA por %s."
                                .formatted(ahora, responsable)));
                if (liquidacion.getSolicitud() != null) {
                    liquidacion.getSolicitud().setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
                    solicitudRepository.save(liquidacion.getSolicitud());
                }
            }
            case CANCELADA -> {
                liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.CANCELADA);
                liquidacion.setTrazabilidad(agregarTraza(
                        liquidacion.getTrazabilidad(),
                        "%s - Liquidación cancelada por %s.".formatted(ahora, responsable)));
            }
            default -> throw new IllegalArgumentException("Solo se permite actualizar liquidaciones a PAGADA, RECOGIDA o CANCELADA");
        }

        if (!isBlank(request.observacion())) {
            liquidacion.setObservacion(trimToNull(request.observacion()));
            liquidacion.setTrazabilidad(agregarTraza(
                    liquidacion.getTrazabilidad(),
                    "%s - Observación: %s".formatted(ahora, request.observacion().trim())));
        }

        return liquidacionRepository.save(liquidacion);
    }

    @Transactional
    public List<LiquidacionCostoSolicitud> procesarLiquidacionesVencidas() {
        List<LiquidacionCostoSolicitud> vencidas = liquidacionRepository
                .findByEstadoLiquidacionInAndFechaLimiteRecojoBefore(ESTADOS_LIQUIDACION_ACTIVA, LocalDate.now());
        for (LiquidacionCostoSolicitud liquidacion : vencidas) {
            archivarLiquidacionPorNoRecojo(liquidacion);
        }
        return liquidacionRepository.saveAll(vencidas);
    }

    @Transactional
    public EncauzamientoSolicitud registrarEncauzamiento(Long solicitudId, RegistrarEncauzamientoSolicitudRequest request) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        validarPuedeEncauzar(solicitud);
        validarSinEncauzamientoActivo(solicitudId);

        Entidad origen = solicitud.getEntidad();
        if (origen == null || origen.getId() == null) {
            throw new IllegalArgumentException("La solicitud no tiene entidad de origen asignada");
        }

        Entidad destino = entidadRepository.findById(request.entidadDestinoId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Entidad destino no encontrada con ID: " + request.entidadDestinoId()));
        validarEntidadDestino(origen, destino);

        LocalDate hoy = LocalDate.now();
        LocalDate fechaRecepcion = solicitud.getFechaPresentacion() != null
                ? solicitud.getFechaPresentacion().toLocalDate()
                : hoy;
        LocalDate fechaLimiteEncauzamiento = DiasHabilesUtil.sumarDiasHabiles(fechaRecepcion, 2);
        if (hoy.isAfter(fechaLimiteEncauzamiento)) {
            throw new IllegalArgumentException("El plazo de 2 días hábiles para encauzar la SAIP ya venció");
        }

        EncauzamientoSolicitud.AlcanceEncauzamiento alcance = parseAlcanceEncauzamiento(request.alcance());
        String responsable = normalizarResponsable(request.responsable(), "Entidad pública");
        LocalDateTime ahora = LocalDateTime.now();

        EncauzamientoSolicitud encauzamiento = new EncauzamientoSolicitud();
        encauzamiento.setSolicitud(solicitud);
        encauzamiento.setEntidadOrigen(origen);
        encauzamiento.setEntidadDestino(destino);
        encauzamiento.setMotivoEncauzamiento(request.motivoEncauzamiento().trim());
        encauzamiento.setAlcance(alcance);
        encauzamiento.setFechaEncauzamiento(ahora);
        encauzamiento.setFechaLimiteEncauzamiento(fechaLimiteEncauzamiento);
        encauzamiento.setEstadoEncauzamiento(EncauzamientoSolicitud.EstadoEncauzamiento.DERIVADO);
        encauzamiento.setResponsable(responsable);
        encauzamiento.setObservacionSustento(trimToNull(request.observacionSustento()));
        encauzamiento.setTrazabilidad("%s - Encauzamiento %s registrado por %s. Origen: %s; destino: %s; límite legal: %s."
                .formatted(ahora, alcance, responsable, origen.getAcronimo(), destino.getAcronimo(), fechaLimiteEncauzamiento));

        if (alcance == EncauzamientoSolicitud.AlcanceEncauzamiento.TOTAL) {
            solicitud.setEntidad(destino);
            solicitud.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
            solicitudRepository.save(solicitud);
        }

        return encauzamientoRepository.save(encauzamiento);
    }

    @Transactional
    public AmpliacionPlazoSolicitud registrarAmpliacion(Long solicitudId, RegistrarAmpliacionPlazoRequest request) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        validarPuedeAmpliar(solicitud);
        validarSinAmpliacionActiva(solicitudId);

        LocalDate fechaNotificacion = request.fechaNotificacionAmpliacion();
        LocalDate fechaRecepcion = solicitud.getFechaPresentacion() != null
                ? solicitud.getFechaPresentacion().toLocalDate()
                : LocalDate.now();
        LocalDate fechaLimiteRegistro = DiasHabilesUtil.sumarDiasHabiles(fechaRecepcion, 4);
        if (fechaNotificacion.isAfter(fechaLimiteRegistro) || LocalDate.now().isAfter(fechaLimiteRegistro)) {
            throw new IllegalArgumentException("La ampliación debe notificarse como máximo hasta el día 4 de atención de la SAIP");
        }

        List<RegistrarEntregaParcialRequest> cronogramaOrdenado = validarCronogramaAmpliacion(
                request.cronograma(),
                fechaNotificacion,
                solicitud.getFechaLimite()
        );

        LocalDate fechaLimiteOriginal = solicitud.getFechaLimite();
        LocalDate fechaLimiteAmpliada = cronogramaOrdenado.getLast().fechaProgramada();
        String responsable = normalizarResponsable(request.responsable(), "Entidad pública");
        LocalDateTime ahora = LocalDateTime.now();

        AmpliacionPlazoSolicitud ampliacion = new AmpliacionPlazoSolicitud();
        ampliacion.setSolicitud(solicitud);
        ampliacion.setMotivoAmpliacion(request.motivoAmpliacion().trim());
        ampliacion.setInformeAmpliacion(request.informeAmpliacion().trim());
        ampliacion.setFechaSolicitudAmpliacion(ahora);
        ampliacion.setFechaNotificacionAmpliacion(fechaNotificacion);
        ampliacion.setFechaLimiteOriginal(fechaLimiteOriginal);
        ampliacion.setFechaLimiteAmpliada(fechaLimiteAmpliada);
        ampliacion.setEstadoAmpliacion(AmpliacionPlazoSolicitud.EstadoAmpliacion.NOTIFICADA);
        ampliacion.setResponsable(responsable);
        ampliacion.setTrazabilidad("%s - Ampliación registrada y notificada por %s. Plazo ordinario %s; nuevo plazo %s."
                .formatted(ahora, responsable, fechaLimiteOriginal, fechaLimiteAmpliada));

        List<CronogramaEntregaParcialSolicitud> entregas = new ArrayList<>();
        for (RegistrarEntregaParcialRequest entregaRequest : cronogramaOrdenado) {
            CronogramaEntregaParcialSolicitud entrega = new CronogramaEntregaParcialSolicitud();
            entrega.setAmpliacion(ampliacion);
            entrega.setNumeroEntrega(entregaRequest.numeroEntrega());
            entrega.setDescripcion(entregaRequest.descripcion().trim());
            entrega.setFechaProgramada(entregaRequest.fechaProgramada());
            entrega.setEstado(CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.PROGRAMADA);
            entrega.setObservacion(trimToNull(entregaRequest.observacion()));
            entregas.add(entrega);
        }
        ampliacion.setCronograma(entregas);

        solicitud.setFechaLimite(fechaLimiteAmpliada);
        solicitudRepository.save(solicitud);
        return ampliacionRepository.save(ampliacion);
    }

    @Transactional
    public CronogramaEntregaParcialSolicitud actualizarEntregaParcial(Long solicitudId,
                                                                      Long ampliacionId,
                                                                      Long entregaId,
                                                                      ActualizarEntregaParcialRequest request) {
        validarSolicitudExiste(solicitudId);
        AmpliacionPlazoSolicitud ampliacion = buscarAmpliacionDeSolicitud(solicitudId, ampliacionId);
        CronogramaEntregaParcialSolicitud entrega = buscarEntregaDeAmpliacion(ampliacionId, entregaId);

        CronogramaEntregaParcialSolicitud.EstadoEntregaParcial nuevoEstado = parseEstadoEntrega(request.estado());
        if (nuevoEstado == CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.ENTREGADA
                && request.fechaEntregaReal() == null) {
            throw new IllegalArgumentException("La fecha real de entrega es obligatoria cuando el estado es ENTREGADA");
        }

        entrega.setEstado(nuevoEstado);
        entrega.setFechaEntregaReal(request.fechaEntregaReal());
        entrega.setObservacion(trimToNull(request.observacion()));

        CronogramaEntregaParcialSolicitud guardada = cronogramaRepository.save(entrega);
        actualizarEstadoAmpliacionSiCorresponde(ampliacion);
        return guardada;
    }

    @Transactional
    public ObservacionSolicitud observarSolicitud(Long solicitudId, ObservarSolicitudRequest request) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        validarPuedeObservar(solicitud);

        LocalDate hoy = LocalDate.now();
        LocalDate fechaRecepcion = solicitud.getFechaPresentacion() != null
                ? solicitud.getFechaPresentacion().toLocalDate()
                : hoy;
        LocalDate fechaLimiteObservacion = DiasHabilesUtil.sumarDiasHabiles(fechaRecepcion, 2);
        if (hoy.isAfter(fechaLimiteObservacion)) {
            throw new IllegalArgumentException("El plazo de 2 días hábiles para observar la SAIP ya venció");
        }

        if (observacionRepository.existsBySolicitud_IdSolicitudAndEstado(
                solicitudId,
                ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION)) {
            throw new IllegalArgumentException("La solicitud ya tiene una observación pendiente de subsanación");
        }

        String responsable = normalizarResponsable(request.responsable(), "Entidad pública");
        LocalDateTime ahora = LocalDateTime.now();
        ObservacionSolicitud observacion = new ObservacionSolicitud();
        observacion.setSolicitud(solicitud);
        observacion.setMotivoObservacion(request.motivoObservacion().trim());
        observacion.setFechaObservacion(ahora);
        observacion.setFechaLimiteSubsanacion(DiasHabilesUtil.sumarDiasHabiles(hoy, 2));
        observacion.setEstado(ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION);
        observacion.setResponsableObservacion(responsable);
        observacion.setTrazabilidad("%s - Observación registrada por %s. Plazo de subsanación hasta %s."
                .formatted(ahora, responsable, observacion.getFechaLimiteSubsanacion()));

        solicitud.setEstado(Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION);
        solicitudRepository.save(solicitud);
        return observacionRepository.save(observacion);
    }

    @Transactional
    public ObservacionSolicitud subsanarSolicitud(Long solicitudId,
                                                  Long observacionId,
                                                  SubsanarSolicitudRequest request) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        ObservacionSolicitud observacion = buscarObservacionDeSolicitud(solicitudId, observacionId);
        validarObservacionPendiente(observacion);

        if (LocalDate.now().isAfter(observacion.getFechaLimiteSubsanacion())) {
            marcarNoSubsanada(observacion, "Sistema SAIP", "Plazo de subsanación vencido");
            throw new IllegalArgumentException("El plazo de subsanación de 2 días hábiles ya venció");
        }

        if (isBlank(request.comentarioSubsanacion())
                && isBlank(request.documentoSubsanacionNombre())
                && isBlank(request.documentoSubsanacionRuta())) {
            throw new IllegalArgumentException("Debe registrar un comentario o documento de subsanación");
        }

        String responsable = normalizarResponsable(request.responsable(), "Ciudadano");
        LocalDateTime ahora = LocalDateTime.now();
        observacion.setEstado(ObservacionSolicitud.EstadoObservacion.SUBSANADA);
        observacion.setFechaSubsanacion(ahora);
        observacion.setComentarioSubsanacion(trimToNull(request.comentarioSubsanacion()));
        observacion.setDocumentoSubsanacionNombre(trimToNull(request.documentoSubsanacionNombre()));
        observacion.setDocumentoSubsanacionRuta(trimToNull(request.documentoSubsanacionRuta()));
        observacion.setResponsableSubsanacion(responsable);
        observacion.setTrazabilidad(agregarTraza(
                observacion.getTrazabilidad(),
                "%s - Subsanación registrada por %s; la solicitud vuelve a revisión.".formatted(ahora, responsable)));

        solicitud.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        solicitudRepository.save(solicitud);
        return observacionRepository.save(observacion);
    }

    @Transactional
    public List<ObservacionSolicitud> procesarObservacionesVencidas() {
        List<ObservacionSolicitud> vencidas = observacionRepository.findByEstadoAndFechaLimiteSubsanacionBefore(
                ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION,
                LocalDate.now()
        );
        for (ObservacionSolicitud observacion : vencidas) {
            marcarNoSubsanada(observacion, "Sistema SAIP", "Cierre automático por falta de subsanación en plazo");
        }
        return observacionRepository.saveAll(vencidas);
    }

    private static final List<Solicitud.EstadoSolicitud> ESTADOS_FINALES_SOLICITUD = List.of(
            Solicitud.EstadoSolicitud.RESPONDIDA,
            Solicitud.EstadoSolicitud.DENEGADA,
            Solicitud.EstadoSolicitud.CONCLUIDA,
            Solicitud.EstadoSolicitud.VENCIDA
    );

    private static final List<AmpliacionPlazoSolicitud.EstadoAmpliacion> ESTADOS_AMPLIACION_ACTIVA = List.of(
            AmpliacionPlazoSolicitud.EstadoAmpliacion.REGISTRADA,
            AmpliacionPlazoSolicitud.EstadoAmpliacion.NOTIFICADA
    );

    private static final List<EncauzamientoSolicitud.EstadoEncauzamiento> ESTADOS_ENCAUZAMIENTO_ACTIVO = List.of(
            EncauzamientoSolicitud.EstadoEncauzamiento.REGISTRADO,
            EncauzamientoSolicitud.EstadoEncauzamiento.DERIVADO
    );

    private static final List<LiquidacionCostoSolicitud.EstadoLiquidacion> ESTADOS_LIQUIDACION_ACTIVA = List.of(
            LiquidacionCostoSolicitud.EstadoLiquidacion.EMITIDA,
            LiquidacionCostoSolicitud.EstadoLiquidacion.NOTIFICADA,
            LiquidacionCostoSolicitud.EstadoLiquidacion.PAGADA
    );

    /**
     * BR-SAIP-005: Detecta y marca solicitudes vencidas (silencio administrativo negativo).
     */
    @Transactional
    public List<Solicitud> detectarSilencioAdministrativo() {
        List<Solicitud> vencidas = solicitudRepository.findVencidas(LocalDate.now(), ESTADOS_FINALES_SOLICITUD);
        for (Solicitud s : vencidas) {
            s.setEstado(Solicitud.EstadoSolicitud.VENCIDA);
        }
        return solicitudRepository.saveAll(vencidas);
    }

    /**
     * Genera el siguiente número de expediente SAIP secuencial.
     * Formato: SAIP-AAAA-NNNNN
     */
    @Transactional
    public String generarExpediente() {
        int year = LocalDate.now().getYear();
        String prefix = "SAIP-" + year + "-";
        Integer maxNum = solicitudRepository.findMaxExpedienteNumber(prefix + "%");
        int nextNum = (maxNum != null ? maxNum : 0) + 1;
        return prefix + String.format("%05d", nextNum);
    }

    @Transactional
    public Solicitud save(Solicitud solicitud) {
        if (solicitud.getExpediente() == null) {
            solicitud.setExpediente(generarExpediente());
        }
        return solicitudRepository.save(solicitud);
    }

    @Transactional
    public Solicitud guardarSolicitud(Solicitud solicitud) {
        return save(solicitud);
    }

    @Transactional
    public void eliminarSolicitud(Long id) {
        solicitudRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public long count() {
        return solicitudRepository.count();
    }

    private Solicitud.EstadoSolicitud convertirEstado(String estado) {
        try {
            return Solicitud.EstadoSolicitud.valueOf(estado.toUpperCase().replace(" ", "_"));
        } catch (IllegalArgumentException e) {
            return Solicitud.EstadoSolicitud.RECEPCIONADA;
        }
    }

    private Solicitud buscarSolicitud(Long solicitudId) {
        return solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + solicitudId));
    }

    private void validarSolicitudExiste(Long solicitudId) {
        if (!solicitudRepository.existsById(solicitudId)) {
            throw new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + solicitudId);
        }
    }

    private ObservacionSolicitud buscarObservacionDeSolicitud(Long solicitudId, Long observacionId) {
        ObservacionSolicitud observacion = observacionRepository.findById(observacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Observación SAIP no encontrada con ID: " + observacionId));
        if (observacion.getSolicitud() == null || !solicitudId.equals(observacion.getSolicitud().getId())) {
            throw new RecursoNoEncontradoException("Observación SAIP no encontrada para la solicitud ID: " + solicitudId);
        }
        return observacion;
    }

    private AmpliacionPlazoSolicitud buscarAmpliacionDeSolicitud(Long solicitudId, Long ampliacionId) {
        AmpliacionPlazoSolicitud ampliacion = ampliacionRepository.findById(ampliacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Ampliación SAIP no encontrada con ID: " + ampliacionId));
        if (ampliacion.getSolicitud() == null || !solicitudId.equals(ampliacion.getSolicitud().getId())) {
            throw new RecursoNoEncontradoException("Ampliación SAIP no encontrada para la solicitud ID: " + solicitudId);
        }
        return ampliacion;
    }

    private CronogramaEntregaParcialSolicitud buscarEntregaDeAmpliacion(Long ampliacionId, Long entregaId) {
        CronogramaEntregaParcialSolicitud entrega = cronogramaRepository.findById(entregaId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Entrega parcial SAIP no encontrada con ID: " + entregaId));
        if (entrega.getAmpliacion() == null || !ampliacionId.equals(entrega.getAmpliacion().getId())) {
            throw new RecursoNoEncontradoException("Entrega parcial SAIP no encontrada para la ampliación ID: " + ampliacionId);
        }
        return entrega;
    }

    private LiquidacionCostoSolicitud buscarLiquidacionDeSolicitud(Long solicitudId, Long liquidacionId) {
        LiquidacionCostoSolicitud liquidacion = liquidacionRepository.findById(liquidacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Liquidación SAIP no encontrada con ID: " + liquidacionId));
        if (liquidacion.getSolicitud() == null || !solicitudId.equals(liquidacion.getSolicitud().getId())) {
            throw new RecursoNoEncontradoException("Liquidación SAIP no encontrada para la solicitud ID: " + solicitudId);
        }
        return liquidacion;
    }

    private void validarPuedeObservar(Solicitud solicitud) {
        if (solicitud.getEstado() == null
                || !(solicitud.getEstado() == Solicitud.EstadoSolicitud.RECEPCIONADA
                || solicitud.getEstado() == Solicitud.EstadoSolicitud.EN_REVISION)) {
            throw new IllegalArgumentException("La solicitud no está en un estado válido para ser observada");
        }
    }

    private void validarPuedeAmpliar(Solicitud solicitud) {
        if (solicitud.getEstado() == null
                || !(solicitud.getEstado() == Solicitud.EstadoSolicitud.RECEPCIONADA
                || solicitud.getEstado() == Solicitud.EstadoSolicitud.EN_REVISION)) {
            throw new IllegalArgumentException("La solicitud no está en un estado válido para ampliar el plazo");
        }
    }

    private void validarPuedeEncauzar(Solicitud solicitud) {
        if (solicitud.getEstado() == null
                || !(solicitud.getEstado() == Solicitud.EstadoSolicitud.RECEPCIONADA
                || solicitud.getEstado() == Solicitud.EstadoSolicitud.EN_REVISION)) {
            throw new IllegalArgumentException("La solicitud no está en un estado válido para encauzar");
        }
    }

    private void validarPuedeEmitirLiquidacion(Solicitud solicitud) {
        if (solicitud.getEstado() == null
                || !(solicitud.getEstado() == Solicitud.EstadoSolicitud.RECEPCIONADA
                || solicitud.getEstado() == Solicitud.EstadoSolicitud.EN_REVISION)) {
            throw new IllegalArgumentException("La solicitud no está en un estado válido para emitir liquidación o cupón de pago");
        }
    }

    private void validarSolicitudRequiereEntregaFisica(Solicitud solicitud) {
        boolean requiereFisico = Boolean.TRUE.equals(solicitud.getFormatoFisico())
                || Boolean.TRUE.equals(solicitud.getCopiaSimple())
                || Boolean.TRUE.equals(solicitud.getCopiaCertificada());
        if (!requiereFisico) {
            throw new IllegalArgumentException("La liquidación o cupón de pago solo aplica para entrega física o reproducción física");
        }
    }

    private void validarSinAmpliacionActiva(Long solicitudId) {
        if (ampliacionRepository.existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(solicitudId, ESTADOS_AMPLIACION_ACTIVA)) {
            throw new IllegalArgumentException("La solicitud ya tiene una ampliación activa");
        }
    }

    private void validarSinEncauzamientoActivo(Long solicitudId) {
        if (encauzamientoRepository.existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(solicitudId, ESTADOS_ENCAUZAMIENTO_ACTIVO)) {
            throw new IllegalArgumentException("La solicitud ya tiene un encauzamiento activo");
        }
    }

    private void validarSinLiquidacionActiva(Long solicitudId) {
        if (liquidacionRepository.existsBySolicitud_IdSolicitudAndEstadoLiquidacionIn(solicitudId, ESTADOS_LIQUIDACION_ACTIVA)) {
            throw new IllegalArgumentException("La solicitud ya tiene una liquidación o cupón activo");
        }
    }

    private void validarLiquidacionNoCerrada(LiquidacionCostoSolicitud liquidacion) {
        if (liquidacion.getEstadoLiquidacion() == LiquidacionCostoSolicitud.EstadoLiquidacion.RECOGIDA
                || liquidacion.getEstadoLiquidacion() == LiquidacionCostoSolicitud.EstadoLiquidacion.ARCHIVADA
                || liquidacion.getEstadoLiquidacion() == LiquidacionCostoSolicitud.EstadoLiquidacion.CANCELADA
                || liquidacion.getEstadoLiquidacion() == LiquidacionCostoSolicitud.EstadoLiquidacion.VENCIDA) {
            throw new IllegalArgumentException("La liquidación ya está cerrada y no puede modificarse");
        }
    }

    private void validarEntidadDestino(Entidad origen, Entidad destino) {
        if (destino == null || !Boolean.TRUE.equals(destino.getActiva())) {
            throw new IllegalArgumentException("La entidad destino debe existir y estar activa");
        }
        if (origen.getId().equals(destino.getId())) {
            throw new IllegalArgumentException("La entidad destino debe ser distinta a la entidad de origen");
        }
    }

    private List<RegistrarEntregaParcialRequest> validarCronogramaAmpliacion(List<RegistrarEntregaParcialRequest> cronograma,
                                                                              LocalDate fechaNotificacion,
                                                                              LocalDate fechaLimiteOriginal) {
        if (cronograma == null || cronograma.isEmpty()) {
            throw new IllegalArgumentException("Debe registrar al menos una entrega parcial");
        }

        List<RegistrarEntregaParcialRequest> ordenado = cronograma.stream()
                .sorted(Comparator.comparing(RegistrarEntregaParcialRequest::numeroEntrega))
                .toList();
        Set<Integer> numeros = new HashSet<>();
        LocalDate fechaAnterior = fechaNotificacion;

        for (RegistrarEntregaParcialRequest entrega : ordenado) {
            if (!numeros.add(entrega.numeroEntrega())) {
                throw new IllegalArgumentException("El número de entrega parcial no puede repetirse");
            }
            if (isBlank(entrega.descripcion())) {
                throw new IllegalArgumentException("La descripción de cada entrega parcial es obligatoria");
            }
            if (entrega.fechaProgramada().isBefore(fechaAnterior)) {
                throw new IllegalArgumentException("Las fechas del cronograma deben ser progresivas");
            }
            long diasEntreEntregas = ChronoUnit.DAYS.between(fechaAnterior, entrega.fechaProgramada());
            if (diasEntreEntregas > 30) {
                throw new IllegalArgumentException("Cada entrega parcial debe programarse en un plazo máximo de 30 días");
            }
            fechaAnterior = entrega.fechaProgramada();
        }

        if (!ordenado.getLast().fechaProgramada().isAfter(fechaLimiteOriginal)) {
            throw new IllegalArgumentException("La fecha límite ampliada debe ser posterior al plazo ordinario de la SAIP");
        }

        return ordenado;
    }

    private void validarObservacionPendiente(ObservacionSolicitud observacion) {
        if (observacion.getEstado() != ObservacionSolicitud.EstadoObservacion.PENDIENTE_SUBSANACION) {
            throw new IllegalArgumentException("La observación no está pendiente de subsanación");
        }
    }

    private void marcarNoSubsanada(ObservacionSolicitud observacion, String responsable, String motivo) {
        LocalDateTime ahora = LocalDateTime.now();
        observacion.setEstado(ObservacionSolicitud.EstadoObservacion.NO_SUBSANADA);
        observacion.setResponsableSubsanacion(responsable);
        observacion.setTrazabilidad(agregarTraza(
                observacion.getTrazabilidad(),
                "%s - %s; solicitud cerrada como CONCLUIDA.".formatted(ahora, motivo)));
        if (observacion.getSolicitud() != null) {
            observacion.getSolicitud().setEstado(Solicitud.EstadoSolicitud.CONCLUIDA);
            solicitudRepository.save(observacion.getSolicitud());
        }
    }

    private CronogramaEntregaParcialSolicitud.EstadoEntregaParcial parseEstadoEntrega(String estado) {
        try {
            return CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.valueOf(estado.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Estado de entrega parcial no válido: " + estado
                    + ". Valores permitidos: PROGRAMADA, ENTREGADA, OBSERVADA, CANCELADA, VENCIDA");
        }
    }

    private EncauzamientoSolicitud.AlcanceEncauzamiento parseAlcanceEncauzamiento(String alcance) {
        try {
            return EncauzamientoSolicitud.AlcanceEncauzamiento.valueOf(alcance.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Alcance de encauzamiento no válido: " + alcance
                    + ". Valores permitidos: TOTAL, PARCIAL");
        }
    }

    private LiquidacionCostoSolicitud.EstadoLiquidacion parseEstadoLiquidacionOperativo(String estado) {
        try {
            LiquidacionCostoSolicitud.EstadoLiquidacion parsed =
                    LiquidacionCostoSolicitud.EstadoLiquidacion.valueOf(estado.trim().toUpperCase());
            if (parsed == LiquidacionCostoSolicitud.EstadoLiquidacion.PAGADA
                    || parsed == LiquidacionCostoSolicitud.EstadoLiquidacion.RECOGIDA
                    || parsed == LiquidacionCostoSolicitud.EstadoLiquidacion.CANCELADA) {
                return parsed;
            }
        } catch (RuntimeException ignored) {
            // Se lanza mensaje uniforme abajo.
        }
        throw new IllegalArgumentException("Estado de liquidación no válido: " + estado
                + ". Valores permitidos para actualización: PAGADA, RECOGIDA, CANCELADA");
    }

    private Solicitud.CanalNotificacion parseCanalNotificacion(String canal) {
        if (isBlank(canal)) {
            throw new IllegalArgumentException("El medio de notificación es obligatorio");
        }
        try {
            return Solicitud.CanalNotificacion.valueOf(canal.trim().toUpperCase());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Medio de notificación no válido: " + canal
                    + ". Valores permitidos: CORREO_ELECTRONICO, CASILLA_ELECTRONICA, PLATAFORMA, FISICA");
        }
    }

    private String generarCodigoLiquidacion(Long solicitudId, String codigoSolicitado) {
        if (!isBlank(codigoSolicitado)) {
            return codigoSolicitado.trim();
        }
        long secuencia = liquidacionRepository.countBySolicitud_IdSolicitud(solicitudId) + 1;
        return "CUPON-%d-%05d-%03d".formatted(LocalDate.now().getYear(), solicitudId, secuencia);
    }

    private BigDecimal normalizarMonto(BigDecimal monto) {
        if (monto == null) {
            throw new IllegalArgumentException("El monto de la liquidación es obligatorio");
        }
        if (monto.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El monto de la liquidación no puede ser negativo");
        }
        return monto;
    }

    private String normalizarMoneda(String moneda) {
        return isBlank(moneda) ? "PEN" : moneda.trim().toUpperCase();
    }

    private void archivarLiquidacionPorNoRecojo(LiquidacionCostoSolicitud liquidacion) {
        LocalDateTime ahora = LocalDateTime.now();
        liquidacion.setEstadoLiquidacion(LiquidacionCostoSolicitud.EstadoLiquidacion.ARCHIVADA);
        liquidacion.setTrazabilidad(agregarTraza(
                liquidacion.getTrazabilidad(),
                "%s - Archivo por no recojo dentro de 30 días hábiles desde la notificación del cupón."
                        .formatted(ahora)));
        if (liquidacion.getSolicitud() != null) {
            liquidacion.getSolicitud().setEstado(Solicitud.EstadoSolicitud.CONCLUIDA);
            solicitudRepository.save(liquidacion.getSolicitud());
        }
    }

    private void actualizarEstadoAmpliacionSiCorresponde(AmpliacionPlazoSolicitud ampliacion) {
        List<CronogramaEntregaParcialSolicitud> entregas = cronogramaRepository
                .findByAmpliacion_IdAmpliacionOrderByNumeroEntregaAsc(ampliacion.getId());
        boolean todasEntregadas = !entregas.isEmpty()
                && entregas.stream().allMatch(entrega ->
                entrega.getEstado() == CronogramaEntregaParcialSolicitud.EstadoEntregaParcial.ENTREGADA);
        if (todasEntregadas && ampliacion.getEstadoAmpliacion() != AmpliacionPlazoSolicitud.EstadoAmpliacion.COMPLETADA) {
            ampliacion.setEstadoAmpliacion(AmpliacionPlazoSolicitud.EstadoAmpliacion.COMPLETADA);
            ampliacion.setTrazabilidad(agregarTraza(
                    ampliacion.getTrazabilidad(),
                    "%s - Cronograma de entregas parciales completado.".formatted(LocalDateTime.now())));
            ampliacionRepository.save(ampliacion);
        }
    }

    private String normalizarResponsable(String responsable, String fallback) {
        return isBlank(responsable) ? fallback : responsable.trim();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String agregarTraza(String actual, String evento) {
        if (actual == null || actual.isBlank()) {
            return evento;
        }
        return actual + System.lineSeparator() + evento;
    }
}

