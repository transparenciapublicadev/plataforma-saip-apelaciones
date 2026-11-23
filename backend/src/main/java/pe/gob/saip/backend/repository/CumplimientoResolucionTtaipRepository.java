package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CumplimientoResolucionTtaipRepository extends JpaRepository<CumplimientoResolucionTtaip, Long> {

    Optional<CumplimientoResolucionTtaip> findByExpediente_IdExpedienteTtaipAndIdNotificacionInicioIsNotNull(Long expedienteId);

    @Query("""
        select c.idCumplimiento from CumplimientoResolucionTtaip c
        where c.idNotificacionInicio is not null and c.estadoCumplimiento = 'PENDIENTE'
            and c.fechaLimiteCumplimiento < :hoy
        order by c.apelacion.idApelacion
        """)
    List<Long> buscarDocumentalesVencidos(LocalDate hoy);

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

    List<CumplimientoResolucionTtaip> findByEstadoCumplimientoInAndFechaLimiteCumplimientoBeforeAndIdNotificacionInicioIsNull(
            Collection<CumplimientoResolucionTtaip.EstadoCumplimiento> estados,
            LocalDate fechaReferencia
    );
}
