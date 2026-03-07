package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.repository.CiudadanoRepository;

import java.util.List;
import java.util.Optional;

@Service
public class CiudadanoService {

    private final CiudadanoRepository ciudadanoRepository;

    public CiudadanoService(CiudadanoRepository ciudadanoRepository) {
        this.ciudadanoRepository = ciudadanoRepository;
    }

    public List<Ciudadano> obtenerTodosLosCiudadanos() {
        return ciudadanoRepository.findAll();
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
