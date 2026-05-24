package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AmpliacionPlazoSolicitudRepository extends JpaRepository<AmpliacionPlazoSolicitud, Long> {

    List<AmpliacionPlazoSolicitud> findBySolicitud_IdSolicitudOrderByFechaSolicitudAmpliacionDesc(Long solicitudId);

    Optional<AmpliacionPlazoSolicitud> findFirstBySolicitud_IdSolicitudAndEstadoAmpliacionInOrderByFechaSolicitudAmpliacionDesc(
            Long solicitudId,
            Collection<AmpliacionPlazoSolicitud.EstadoAmpliacion> estados
    );

    boolean existsBySolicitud_IdSolicitudAndEstadoAmpliacionIn(
            Long solicitudId,
            Collection<AmpliacionPlazoSolicitud.EstadoAmpliacion> estados
    );
}
