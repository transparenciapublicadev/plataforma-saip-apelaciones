package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.DescargoEntidadTtaip;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DescargoEntidadTtaipRepository extends JpaRepository<DescargoEntidadTtaip, Long> {

    List<DescargoEntidadTtaip> findByExpediente_IdExpedienteTtaipOrderByFechaRequerimientoDesc(Long expedienteId);

    Optional<DescargoEntidadTtaip> findFirstByExpediente_IdExpedienteTtaipAndEstadoDescargoInOrderByFechaRequerimientoDesc(
            Long expedienteId,
            List<DescargoEntidadTtaip.EstadoDescargo> estados
    );

    boolean existsByExpediente_IdExpedienteTtaipAndEstadoDescargoIn(
            Long expedienteId,
            List<DescargoEntidadTtaip.EstadoDescargo> estados
    );

    List<DescargoEntidadTtaip> findByEstadoDescargoInAndFechaLimiteDescargoBefore(
            List<DescargoEntidadTtaip.EstadoDescargo> estados,
            LocalDate fecha
    );
}
