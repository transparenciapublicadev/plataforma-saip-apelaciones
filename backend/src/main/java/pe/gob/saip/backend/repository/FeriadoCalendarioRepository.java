package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.FeriadoCalendario;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface FeriadoCalendarioRepository extends JpaRepository<FeriadoCalendario, String> {

    List<FeriadoCalendario> findByActivoTrue();

    List<FeriadoCalendario> findByActivoTrueAndRecurrenteTrue();

    List<FeriadoCalendario> findByActivoTrueAndFechaBetween(LocalDate inicio, LocalDate fin);
}
