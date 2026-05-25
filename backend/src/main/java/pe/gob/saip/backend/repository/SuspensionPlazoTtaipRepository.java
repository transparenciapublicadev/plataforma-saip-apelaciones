package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.SuspensionPlazoTtaip;

import java.util.List;
import java.util.Optional;

@Repository
public interface SuspensionPlazoTtaipRepository extends JpaRepository<SuspensionPlazoTtaip, Long> {

    List<SuspensionPlazoTtaip> findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(Long expedienteId);

    Optional<SuspensionPlazoTtaip> findFirstByDescargo_IdDescargoOrderByFechaCreacionDesc(Long descargoId);
}
