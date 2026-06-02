package pe.gob.saip.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;

@Repository
public interface DispositivoNotificacionPushRepository extends JpaRepository<DispositivoNotificacionPush, Long> {

    Optional<DispositivoNotificacionPush> findByTokenHash(String tokenHash);

    List<DispositivoNotificacionPush> findByUsuario_IdUsuarioOrderByFechaActualizacionDesc(Long usuarioId);

    List<DispositivoNotificacionPush> findByUsuario_IdUsuarioAndDeviceIdHashAndAppFlavorAndEstado(
            Long usuarioId,
            String deviceIdHash,
            DispositivoNotificacionPush.AppFlavor appFlavor,
            DispositivoNotificacionPush.EstadoDispositivo estado);

    List<DispositivoNotificacionPush> findByUsuario_IdUsuarioAndDeviceIdHashAndEstado(
            Long usuarioId,
            String deviceIdHash,
            DispositivoNotificacionPush.EstadoDispositivo estado);
}
