package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ObservarSolicitudRequest;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ObservacionSolicitudRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SolicitudService {

    private final SolicitudRepository solicitudRepository;
    private final ObservacionSolicitudRepository observacionRepository;

    public SolicitudService(SolicitudRepository solicitudRepository,
                            ObservacionSolicitudRepository observacionRepository) {
        this.solicitudRepository = solicitudRepository;
        this.observacionRepository = observacionRepository;
    }

    @Transactional(readOnly = true)
    public List<Solicitud> obtenerTodasLasSolicitudes() {
        return solicitudRepository.findAll();
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
    public List<Solicitud> findByEntidadId(Long entidadId) {
        return solicitudRepository.findByEntidad_IdEntidadOrderByFechaPresentacionDesc(entidadId);
    }

    @Transactional(readOnly = true)
    public List<Solicitud> obtenerSolicitudesPorEstado(Solicitud.EstadoSolicitud estado) {
        return solicitudRepository.findByEstado(estado);
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

    private void validarPuedeObservar(Solicitud solicitud) {
        if (solicitud.getEstado() == null
                || !(solicitud.getEstado() == Solicitud.EstadoSolicitud.RECEPCIONADA
                || solicitud.getEstado() == Solicitud.EstadoSolicitud.EN_REVISION)) {
            throw new IllegalArgumentException("La solicitud no está en un estado válido para ser observada");
        }
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

