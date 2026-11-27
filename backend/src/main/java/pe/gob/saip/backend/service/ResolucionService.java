package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.repository.ResolucionRepository;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class ResolucionService {

    private final ResolucionRepository resolucionRepository;

    public ResolucionService(ResolucionRepository resolucionRepository) {
        this.resolucionRepository = resolucionRepository;
    }

    @Transactional(readOnly = true)
    public List<Resolucion> obtenerTodasLasResoluciones() {
        return resolucionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Resolucion> obtenerResolucionPorId(Long id) {
        return resolucionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Resolucion> obtenerResolucionesPorApelacion(Long apelacionId) {
        return resolucionRepository.findByApelacion_Id(apelacionId);
    }

    @Transactional(readOnly = true)
    public List<Resolucion> obtenerResolucionesPorTipo(Resolucion.TipoResolucion tipo) {
        return resolucionRepository.findByTipoResolucion(tipo);
    }

    @Transactional(readOnly = true)
    public Set<Long> idsDeApelacionesConResolucionFinal() {
        Set<Long> ids = new LinkedHashSet<>();
        for (Resolucion resolucion : resolucionRepository.findByTipoResolucion(Resolucion.TipoResolucion.RESOLUCION_FINAL)) {
            Apelacion apelacion = resolucion.getApelacion();
            if (apelacion != null && apelacion.getId() != null) {
                ids.add(apelacion.getId());
            }
        }
        return ids;
    }

    @Transactional
    public void guardarResolucion(Resolucion resolucion) {
        resolucionRepository.save(resolucion);
    }

    @Transactional
    public void save(Resolucion resolucion) {
        resolucionRepository.save(resolucion);
    }

    @Transactional
    public void eliminarResolucion(Long id) {
        resolucionRepository.deleteById(id);
    }
}
