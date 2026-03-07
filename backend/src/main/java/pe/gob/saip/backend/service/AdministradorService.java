package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import pe.gob.saip.backend.model.entity.Administrador;
import pe.gob.saip.backend.repository.AdministradorRepository;

import java.util.List;
import java.util.Optional;

@Service
public class AdministradorService {

    private final AdministradorRepository administradorRepository;

    public AdministradorService(AdministradorRepository administradorRepository) {
        this.administradorRepository = administradorRepository;
    }

    public List<Administrador> obtenerTodosLosAdministradores() {
        return administradorRepository.findAll();
    }

    public Optional<Administrador> obtenerAdministradorPorId(Long id) {
        return administradorRepository.findById(id);
    }

    public Optional<Administrador> obtenerAdministradorPorEmail(String email) {
        return administradorRepository.findAll().stream()
                .filter(a -> a.getEmail().equals(email))
                .findFirst();
    }

    public void guardarAdministrador(Administrador administrador) {
        administradorRepository.save(administrador);
    }

    public void eliminarAdministrador(Long id) {
        administradorRepository.deleteById(id);
    }
}
