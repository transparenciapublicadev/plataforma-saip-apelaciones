package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;

import java.util.Optional;
import java.util.List;

@Repository
public interface NotificacionTtaipRepository extends JpaRepository<NotificacionTtaip, Long> {

    boolean existsByCedula_IdCedula(Long cedulaId);

    Optional<NotificacionTtaip> findByCedula_NumeroCedulaAndDestinatario(
            String numeroCedula,
            CedulaNotificacion.DestinatarioNotificacion destinatario
    );

    List<NotificacionTtaip> findByExpediente_IdExpedienteTtaipOrderByFechaNotificacionAsc(Long expedienteId);

    Optional<NotificacionTtaip> findByIdNotificacionAndExpediente_IdExpedienteTtaip(
            Long notificacionId,
            Long expedienteId
    );
}
