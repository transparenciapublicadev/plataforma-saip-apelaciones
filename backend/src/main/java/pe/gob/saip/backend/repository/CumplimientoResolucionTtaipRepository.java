package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CumplimientoResolucionTtaipRepository extends JpaRepository<CumplimientoResolucionTtaip, Long> {

    List<CumplimientoResolucionTtaip> findByExpediente_IdExpedienteTtaipOrderByFechaRequerimientoCumplimientoDesc(
            Long expedienteId
    );

    Optional<CumplimientoResolucionTtaip> findFirstByExpediente_IdExpedienteTtaipAndEstadoCumplimientoInOrderByFechaRequerimientoCumplimientoDesc(
            Long expedienteId,
            Collection<CumplimientoResolucionTtaip.EstadoCumplimiento> estados
    );

    boolean existsByResolucion_IdResolucionAndEstadoCumplimientoIn(
            Long resolucionId,
            Collection<CumplimientoResolucionTtaip.EstadoCumplimiento> estados
    );

    List<CumplimientoResolucionTtaip> findByEstadoCumplimientoInAndFechaLimiteCumplimientoBefore(
            Collection<CumplimientoResolucionTtaip.EstadoCumplimiento> estados,
            LocalDate fechaReferencia
    );
}
