package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.EncauzamientoSolicitud;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface EncauzamientoSolicitudRepository extends JpaRepository<EncauzamientoSolicitud, Long> {

    List<EncauzamientoSolicitud> findBySolicitud_IdSolicitudOrderByFechaEncauzamientoDesc(Long solicitudId);

    Optional<EncauzamientoSolicitud> findFirstBySolicitud_IdSolicitudAndEstadoEncauzamientoInOrderByFechaEncauzamientoDesc(
            Long solicitudId,
            Collection<EncauzamientoSolicitud.EstadoEncauzamiento> estados
    );

    boolean existsBySolicitud_IdSolicitudAndEstadoEncauzamientoIn(
            Long solicitudId,
            Collection<EncauzamientoSolicitud.EstadoEncauzamiento> estados
    );

    boolean existsBySolicitud_IdSolicitudAndAlcanceAndEstadoEncauzamientoInAndSolicitudDerivadaIsNotNull(
            Long solicitudId,
            EncauzamientoSolicitud.AlcanceEncauzamiento alcance,
            Collection<EncauzamientoSolicitud.EstadoEncauzamiento> estados
    );
}
