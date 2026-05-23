package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MiembroTTAIPRepository extends JpaRepository<MiembroTTAIP, Long> {

    Optional<MiembroTTAIP> findByEmail(String email);

    List<MiembroTTAIP> findBySala(String sala);

    List<MiembroTTAIP> findByEmailInAndActivoTrueOrderBySalaAscCargoAscNombreCompletoAsc(Collection<String> emails);

    List<MiembroTTAIP> findBySalaAndEmailInAndActivoTrueOrderByCargoAscNombreCompletoAsc(String sala, Collection<String> emails);

    List<MiembroTTAIP> findByActivoTrueAndPeriodoInicioIsNotNullAndPeriodoFinIsNotNullOrderBySalaAscCargoAscNombreCompletoAsc();

    List<MiembroTTAIP> findBySalaAndActivoTrueAndPeriodoInicioIsNotNullAndPeriodoFinIsNotNullOrderByCargoAscNombreCompletoAsc(String sala);
}

