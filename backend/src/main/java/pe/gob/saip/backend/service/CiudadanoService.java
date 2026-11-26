package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.repository.CiudadanoRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CiudadanoService {

    private final CiudadanoRepository ciudadanoRepository;

    public CiudadanoService(CiudadanoRepository ciudadanoRepository) {
        this.ciudadanoRepository = ciudadanoRepository;
    }

    @Transactional(readOnly = true)
    public List<Ciudadano> obtenerTodosLosCiudadanos() {
        return ciudadanoRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> filasReporte() {
        return ciudadanoRepository.findAll().stream()
                .map(ciudadano -> {
                    Map<String, Object> fila = new HashMap<>();
                    fila.put("id", ciudadano.getId());
                    fila.put("nombreCompleto", ciudadano.getNombreCompleto());
                    fila.put("dni", ciudadano.getDni());
                    fila.put("email", ciudadano.getEmail());
                    fila.put("activo", ciudadano.getActivo());
                    fila.put("fechaRegistro", ciudadano.getFechaRegistro() != null ? ciudadano.getFechaRegistro().toString() : null);
                    fila.put("totalSolicitudes", ciudadano.getSolicitudes() != null ? ciudadano.getSolicitudes().size() : 0);
                    fila.put("totalApelaciones", ciudadano.getApelaciones() != null ? ciudadano.getApelaciones().size() : 0);
                    return fila;
                })
                .toList();
    }

    public Optional<Ciudadano> obtenerCiudadanoPorId(Long id) {
        return ciudadanoRepository.findById(id);
    }

    public Optional<Ciudadano> findById(Long id) {
        return ciudadanoRepository.findById(id);
    }

    public Optional<Ciudadano> obtenerCiudadanoPorDni(String dni) {
        return ciudadanoRepository.findByDni(dni);
    }

    public Optional<Ciudadano> obtenerCiudadanoPorEmail(String email) {
        return ciudadanoRepository.findByEmail(email);
    }

    public Boolean existeDni(String dni) {
        return ciudadanoRepository.findByDni(dni).isPresent();
    }

    public Ciudadano guardarCiudadano(Ciudadano ciudadano) {
        return ciudadanoRepository.save(ciudadano);
    }

    public void eliminarCiudadano(Long id) {
        ciudadanoRepository.deleteById(id);
    }
}
