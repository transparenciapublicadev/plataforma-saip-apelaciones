package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.ReprocesoNotificacion;

import java.util.List;

@Repository
public interface ReprocesoNotificacionRepository extends JpaRepository<ReprocesoNotificacion, Long> {

    List<ReprocesoNotificacion> findByExpediente_IdExpedienteTtaipOrderByFechaCreacionAsc(Long expedienteId);

    java.util.Optional<ReprocesoNotificacion> findFirstByNotificacion_IdNotificacion(Long id);

    long countByCedulaOriginal_IdCedulaAndDestinatario(
            Long cedulaOriginalId,
            CedulaNotificacion.DestinatarioNotificacion destinatario
    );
}
