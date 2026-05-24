package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ObservacionSolicitudRepository extends JpaRepository<ObservacionSolicitud, Long> {

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
