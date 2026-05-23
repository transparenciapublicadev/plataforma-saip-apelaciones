package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;
import pe.gob.saip.backend.repository.MiembroTTAIPRepository;

import java.util.List;
import java.util.Optional;

@Service
public class MiembroTTAIPService {

    private static final List<String> CORREOS_OFICIALES_TTAIP = List.of(
            "tvalverde@minjus.gob.pe",
            "lagurto@minjus.gob.pe",
            "szamora@minjus.gob.pe",
            "jpichon@minjus.gob.pe",
            "jmancilla@minjus.gob.pe",
            "jrojasb@minjus.gob.pe"
    );

    private final MiembroTTAIPRepository miembroTTAIPRepository;

    public MiembroTTAIPService(MiembroTTAIPRepository miembroTTAIPRepository) {
        this.miembroTTAIPRepository = miembroTTAIPRepository;
    }

    @Transactional(readOnly = true)
    public List<MiembroTTAIP> obtenerTodosLosMiembrosTTAIP() {
        return miembroTTAIPRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<MiembroTTAIP> obtenerMiembroTTAIPPorId(Long id) {
        return miembroTTAIPRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<MiembroTTAIP> obtenerMiembroTTAIPPorEmail(String email) {
        return miembroTTAIPRepository.findByEmail(email);
    }

    @Transactional(readOnly = true)
    public List<MiembroTTAIP> obtenerMiembrosTTAIPPorSala(String sala) {
        return miembroTTAIPRepository.findBySala(sala);
    }

    @Transactional(readOnly = true)
    public List<MiembroTTAIP> obtenerMiembrosTTAIPActivos() {
        List<MiembroTTAIP> oficiales = miembroTTAIPRepository
                .findByEmailInAndActivoTrueOrderBySalaAscCargoAscNombreCompletoAsc(CORREOS_OFICIALES_TTAIP);
        if (!oficiales.isEmpty()) {
            return oficiales;
        }

        return obtenerMiembrosTTAIPActivosConPeriodo();
    }

    @Transactional(readOnly = true)
    public List<MiembroTTAIP> obtenerMiembrosTTAIPActivosPorSala(String sala) {
        List<MiembroTTAIP> oficiales = miembroTTAIPRepository
                .findBySalaAndEmailInAndActivoTrueOrderByCargoAscNombreCompletoAsc(sala, CORREOS_OFICIALES_TTAIP);
        if (!oficiales.isEmpty()) {
            return oficiales;
        }

        List<MiembroTTAIP> conPeriodo = miembroTTAIPRepository
                .findBySalaAndActivoTrueAndPeriodoInicioIsNotNullAndPeriodoFinIsNotNullOrderByCargoAscNombreCompletoAsc(sala);
        return conPeriodo.isEmpty() ? miembroTTAIPRepository.findBySala(sala) : conPeriodo;
    }

    private List<MiembroTTAIP> obtenerMiembrosTTAIPActivosConPeriodo() {
        List<MiembroTTAIP> conPeriodo = miembroTTAIPRepository
                .findByActivoTrueAndPeriodoInicioIsNotNullAndPeriodoFinIsNotNullOrderBySalaAscCargoAscNombreCompletoAsc();
        return conPeriodo.isEmpty() ? miembroTTAIPRepository.findAll() : conPeriodo;
    }

    @Transactional
    public void guardarMiembroTTAIP(MiembroTTAIP miembroTTAIP) {
        miembroTTAIPRepository.save(miembroTTAIP);
    }

    @Transactional
    public void eliminarMiembroTTAIP(Long id) {
        miembroTTAIPRepository.deleteById(id);
    }
}
