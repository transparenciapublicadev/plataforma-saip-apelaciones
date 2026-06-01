package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;

import java.util.List;

@Repository
public interface IntentoNotificacionRepository extends JpaRepository<IntentoNotificacion, Long> {

    List<IntentoNotificacion> findByNotificacionTtaip_IdNotificacionOrderByFechaIntentoAsc(Long notificacionId);

    List<IntentoNotificacion> findBySolicitud_IdSolicitudOrderByFechaIntentoAsc(Long solicitudId);
}
