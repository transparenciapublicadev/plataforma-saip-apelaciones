package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ObservacionSolicitudRepository extends JpaRepository<ObservacionSolicitud, Long> {

    /** Serializes precision receipt creation and legacy subsanation for the same observation. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from ObservacionSolicitud o where o.idObservacion = :id")
    Optional<ObservacionSolicitud> findByIdForUpdate(@Param("id") Long id);

    List<ObservacionSolicitud> findBySolicitud_IdSolicitudOrderByFechaObservacionDesc(Long solicitudId);

    Optional<ObservacionSolicitud> findFirstBySolicitud_IdSolicitudAndEstadoOrderByFechaObservacionDesc(
            Long solicitudId,
            ObservacionSolicitud.EstadoObservacion estado
    );

    boolean existsBySolicitud_IdSolicitudAndEstado(
            Long solicitudId,
            ObservacionSolicitud.EstadoObservacion estado
    );

    List<ObservacionSolicitud> findByEstadoAndFechaLimiteSubsanacionBefore(
            ObservacionSolicitud.EstadoObservacion estado,
            LocalDate fecha
    );
}
