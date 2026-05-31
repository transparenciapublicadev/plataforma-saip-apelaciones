package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.AdmitirElevacionExcepcionalRequest;
import pe.gob.saip.backend.model.dto.ComunicarOmisionElevacionRequest;
import pe.gob.saip.backend.model.dto.CrearApelacionAnteEntidadRequest;
import pe.gob.saip.backend.model.dto.ElevarApelacionTtaipRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ElevacionApelacionTtaipService {

    private static final int DIAS_HABILES_ELEVACION = 2;

    private final ElevacionApelacionTtaipRepository elevacionRepository;
    private final ApelacionService apelacionService;
    private final SolicitudService solicitudService;
    private final CiudadanoService ciudadanoService;
    private final ExpedienteTtaipService expedienteTtaipService;

    public ElevacionApelacionTtaipService(ElevacionApelacionTtaipRepository elevacionRepository,
                                          ApelacionService apelacionService,
                                          SolicitudService solicitudService,
                                          CiudadanoService ciudadanoService,
                                          ExpedienteTtaipService expedienteTtaipService) {
        this.elevacionRepository = elevacionRepository;
        this.apelacionService = apelacionService;
        this.solicitudService = solicitudService;
        this.ciudadanoService = ciudadanoService;
        this.expedienteTtaipService = expedienteTtaipService;
    }

    @Transactional
    public Apelacion registrarPresentacionAnteEntidad(CrearApelacionAnteEntidadRequest request) {
        Solicitud solicitud = solicitudService.findById(request.solicitudId())
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Solicitud no encontrada con ID: " + request.solicitudId()));
        if (solicitud.getApelacion() != null) {
            throw new IllegalArgumentException("La solicitud ya tiene una apelación asociada");
        }
        Entidad entidadOrigen = solicitud.getEntidad();
        if (entidadOrigen == null || !Boolean.TRUE.equals(entidadOrigen.getActiva())) {
            throw new IllegalArgumentException("La entidad receptora de la apelación debe existir y estar activa");
        }
        Ciudadano ciudadano = ciudadanoService.findById(request.ciudadanoId())
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Ciudadano no encontrado con ID: " + request.ciudadanoId()));
        if (solicitud.getCiudadano() == null || !request.ciudadanoId().equals(solicitud.getCiudadano().getId())) {
            throw new IllegalArgumentException("La solicitud no pertenece al ciudadano indicado");
        }
        if (request.fechaPresentacionAnteEntidad().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("La fecha de presentación ante la entidad no puede estar en el futuro");
        }

        Apelacion apelacion = new Apelacion();
        apelacion.setFundamentos(request.fundamentos().trim());
        apelacion.setSolicitud(solicitud);
        apelacion.setTipoOrigen(Apelacion.TipoOrigenApelacion.SAIP_INTERNA);
        apelacion.setCiudadano(ciudadano);
        apelacion.setEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        Apelacion saved = apelacionService.save(apelacion);

        ElevacionApelacionTtaip elevacion = new ElevacionApelacionTtaip();
        elevacion.setApelacion(saved);
        elevacion.setEntidadOrigen(entidadOrigen);
        elevacion.setFechaPresentacionAnteEntidad(request.fechaPresentacionAnteEntidad());
        elevacion.setFechaLimiteElevacion(DiasHabilesUtil.sumarDiasHabiles(
                request.fechaPresentacionAnteEntidad(),
                DIAS_HABILES_ELEVACION));
        elevacion.setReferenciaCargoPresentacion(request.referenciaCargoPresentacion().trim());
        elevacion.setObservacion(normalizarNullable(request.observacion()));
        elevacion.setEstadoElevacion(ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE);
        elevacion.setTrazabilidad(agregarTraza(
                null,
                "Apelación presentada ante la entidad; pendiente de elevación al TTAIP hasta "
                        + elevacion.getFechaLimiteElevacion() + "."));
        saved.setElevacion(elevacionRepository.save(elevacion));
        solicitud.setApelacion(saved);
        return saved;
    }

    @Transactional(readOnly = true)
    public ElevacionApelacionTtaip obtenerPorApelacion(Long apelacionId) {
        return buscarPorApelacion(apelacionId);
    }

    @Transactional(readOnly = true)
    public List<ElevacionApelacionTtaip> listarPendientesPorEntidad(Long entidadId) {
        return elevacionRepository
                .findByEntidadOrigen_IdEntidadAndEstadoElevacionOrderByFechaLimiteElevacionAsc(
                        entidadId,
                        ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE);
    }

    @Transactional
    public Apelacion elevar(Long apelacionId, ElevarApelacionTtaipRequest request) {
        ElevacionApelacionTtaip elevacion = buscarPorApelacion(apelacionId);
        validarPendiente(elevacion);
        if (LocalDate.now().isAfter(elevacion.getFechaLimiteElevacion())) {
            marcarVencida(elevacion);
            throw new IllegalArgumentException(
                    "El plazo de 2 días hábiles para elevar la apelación venció el "
                            + elevacion.getFechaLimiteElevacion());
        }

        elevacion.setEstadoElevacion(ElevacionApelacionTtaip.EstadoElevacion.ELEVADA);
        elevacion.setFechaElevacionTtaip(LocalDateTime.now());
        elevacion.setResponsableEntidad(request.responsableEntidad().trim());
        elevacion.setReferenciaExpedienteElevado(request.referenciaExpedienteElevado().trim());
        elevacion.setObservacion(combinarObservacion(elevacion.getObservacion(), request.observacion()));
        elevacion.setTrazabilidad(agregarTraza(
                elevacion.getTrazabilidad(),
                "Entidad elevó apelación al TTAIP dentro del plazo legal. Referencia: "
                        + request.referenciaExpedienteElevado().trim() + "."));
        elevacionRepository.save(elevacion);

        Apelacion apelacion = elevacion.getApelacion();
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        Apelacion saved = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(saved);
        return saved;
    }

    @Transactional
    public List<ElevacionApelacionTtaip> procesarVencidas() {
        List<ElevacionApelacionTtaip> vencidas = elevacionRepository
                .findByEstadoElevacionAndFechaLimiteElevacionBefore(
                        ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE,
                        LocalDate.now());
        vencidas.forEach(this::marcarVencida);
        return elevacionRepository.saveAll(vencidas);
    }

    @Transactional
    public ElevacionApelacionTtaip comunicarOmision(Long apelacionId, ComunicarOmisionElevacionRequest request) {
        ElevacionApelacionTtaip elevacion = buscarPorApelacion(apelacionId);
        if (elevacion.getEstadoElevacion() == ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE
                && LocalDate.now().isAfter(elevacion.getFechaLimiteElevacion())) {
            marcarVencida(elevacion);
        }
        if (elevacion.getEstadoElevacion() != ElevacionApelacionTtaip.EstadoElevacion.VENCIDA_NO_ELEVADA) {
            throw new IllegalArgumentException(
                    "Solo se puede comunicar omisión cuando venció el plazo de elevación sin remisión al TTAIP");
        }

        elevacion.setEstadoElevacion(ElevacionApelacionTtaip.EstadoElevacion.COMUNICADA_POR_CIUDADANO);
        elevacion.setFechaComunicacionCiudadano(LocalDateTime.now());
        elevacion.setReferenciaPruebaOmision(request.referenciaPruebaOmision().trim());
        elevacion.setObservacion(combinarObservacion(elevacion.getObservacion(), request.observacion()));
        elevacion.setTrazabilidad(agregarTraza(
                elevacion.getTrazabilidad(),
                "Ciudadano comunicó omisión de elevación y adjuntó prueba: "
                        + request.referenciaPruebaOmision().trim() + "."));
        return elevacionRepository.save(elevacion);
    }

    @Transactional
    public Apelacion admitirExcepcionalmente(Long apelacionId, AdmitirElevacionExcepcionalRequest request) {
        ElevacionApelacionTtaip elevacion = buscarPorApelacion(apelacionId);
        if (elevacion.getEstadoElevacion() != ElevacionApelacionTtaip.EstadoElevacion.COMUNICADA_POR_CIUDADANO) {
            throw new IllegalArgumentException(
                    "La admisión excepcional exige una comunicación ciudadana previa con prueba de omisión");
        }

        elevacion.setEstadoElevacion(ElevacionApelacionTtaip.EstadoElevacion.ADMITIDA_EXCEPCIONALMENTE);
        elevacion.setResponsableTtaip(request.responsableTtaip().trim());
        elevacion.setObservacion(combinarObservacion(elevacion.getObservacion(), request.observacion()));
        elevacion.setTrazabilidad(agregarTraza(
                elevacion.getTrazabilidad(),
                "TTAIP admitió excepcionalmente la apelación por omisión acreditada de la entidad."));
        elevacionRepository.save(elevacion);

        Apelacion apelacion = elevacion.getApelacion();
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        Apelacion saved = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(saved);
        return saved;
    }

    private ElevacionApelacionTtaip buscarPorApelacion(Long apelacionId) {
        return elevacionRepository.findByApelacion_IdApelacion(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Elevación no encontrada para la apelación ID: " + apelacionId));
    }

    private void validarPendiente(ElevacionApelacionTtaip elevacion) {
        if (elevacion.getEstadoElevacion() != ElevacionApelacionTtaip.EstadoElevacion.PENDIENTE) {
            throw new IllegalArgumentException("La elevación ya no está pendiente de remisión al TTAIP");
        }
    }

    private void marcarVencida(ElevacionApelacionTtaip elevacion) {
        elevacion.setEstadoElevacion(ElevacionApelacionTtaip.EstadoElevacion.VENCIDA_NO_ELEVADA);
        elevacion.setTrazabilidad(agregarTraza(
                elevacion.getTrazabilidad(),
                "Venció el plazo de 2 días hábiles sin elevación por la entidad."));
    }

    private String combinarObservacion(String actual, String adicional) {
        String normalizada = normalizarNullable(adicional);
        if (normalizada == null) {
            return actual;
        }
        return actual == null || actual.isBlank() ? normalizada : actual + "\n" + normalizada;
    }

    private String agregarTraza(String actual, String evento) {
        String registro = LocalDateTime.now() + " - " + evento;
        return actual == null || actual.isBlank() ? registro : actual + "\n" + registro;
    }

    private String normalizarNullable(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
