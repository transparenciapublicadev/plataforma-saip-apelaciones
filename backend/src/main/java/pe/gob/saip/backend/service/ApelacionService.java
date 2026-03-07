package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.repository.ApelacionRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class ApelacionService {

    private final ApelacionRepository apelacionRepository;

    public ApelacionService(ApelacionRepository apelacionRepository) {
        this.apelacionRepository = apelacionRepository;
    }

    @Transactional(readOnly = true)
    public List<Apelacion> obtenerTodasLasApelaciones() {
        return apelacionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> obtenerApelacionPorId(Long id) {
        return apelacionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> obtenerApelacionPorExpediente(String expediente) {
        return apelacionRepository.findByExpediente(expediente);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> obtenerApelacionesPorEstado(Apelacion.EstadoApelacion estado) {
        return apelacionRepository.findByEstadoOrderByFechaApelacionDesc(estado);
    }

    @Transactional(readOnly = true)
    public long contarApelacionesPorEstado(Apelacion.EstadoApelacion estado) {
        return apelacionRepository.countByEstado(estado);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> findByCiudadanoId(Long ciudadanoId) {
        return apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(ciudadanoId);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> findPendientes() {
        return apelacionRepository.findPendientes();
    }

    @Transactional(readOnly = true)
    public List<Apelacion> findAll() {
        return apelacionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findByExpediente(String expediente) {
        return apelacionRepository.findByExpedienteWithDetails(expediente);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findById(Long id) {
        return apelacionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findByIdWithDetails(Long id) {
        return apelacionRepository.findByIdWithDetails(id);
    }

    /**
     * Genera el siguiente número de expediente TTAIP secuencial.
     * Formato: NNNNN-AAAA-JUS-TTAIP (sin barra para compatibilidad con URLs REST y rutas Angular)
     */
    @Transactional
    public String generarExpediente() {
        int year = LocalDate.now().getYear();
        long count = apelacionRepository.count() + 1;
        return String.format("%05d", count) + "-" + year + "-JUS-TTAIP";
    }

    @Transactional
    public Apelacion save(Apelacion apelacion) {
        if (apelacion.getExpediente() == null) {
            apelacion.setExpediente(generarExpediente());
        }
        return apelacionRepository.save(apelacion);
    }

    @Transactional
    public Apelacion guardar(Apelacion apelacion) {
        return save(apelacion);
    }

    @Transactional
    public void guardarApelacion(Apelacion apelacion) {
        save(apelacion);
    }

    @Transactional
    public void eliminarApelacion(Long id) {
        apelacionRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public long count() {
        return apelacionRepository.count();
    }

    @Transactional(readOnly = true)
    public long countByCiudadanoId(Long ciudadanoId) {
        return apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(ciudadanoId).size();
    }
}
