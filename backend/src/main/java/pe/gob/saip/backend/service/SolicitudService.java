package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.SolicitudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class SolicitudService {

    private final SolicitudRepository solicitudRepository;

    public SolicitudService(SolicitudRepository solicitudRepository) {
        this.solicitudRepository = solicitudRepository;
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

    /**
     * BR-SAIP-005: Detecta y marca solicitudes vencidas (silencio administrativo negativo).
     */
    @Transactional
    public List<Solicitud> detectarSilencioAdministrativo() {
        List<Solicitud> vencidas = solicitudRepository.findVencidas(LocalDate.now());
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
}

