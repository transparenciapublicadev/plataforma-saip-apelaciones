package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.LiquidacionCostoSolicitud;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface LiquidacionCostoSolicitudRepository extends JpaRepository<LiquidacionCostoSolicitud, Long> {

    List<LiquidacionCostoSolicitud> findBySolicitud_IdSolicitudOrderByFechaEmisionDesc(Long solicitudId);

    Optional<LiquidacionCostoSolicitud> findFirstBySolicitud_IdSolicitudAndEstadoLiquidacionInOrderByFechaEmisionDesc(
            Long solicitudId,
            Collection<LiquidacionCostoSolicitud.EstadoLiquidacion> estados
    );

    boolean existsBySolicitud_IdSolicitudAndEstadoLiquidacionIn(
            Long solicitudId,
            Collection<LiquidacionCostoSolicitud.EstadoLiquidacion> estados
    );

    long countBySolicitud_IdSolicitud(Long solicitudId);

    List<LiquidacionCostoSolicitud> findByEstadoLiquidacionInAndFechaLimiteRecojoBefore(
            Collection<LiquidacionCostoSolicitud.EstadoLiquidacion> estados,
            LocalDate fecha
    );
}
