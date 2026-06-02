package pe.gob.saip.backend.model.dto;

import java.time.LocalDateTime;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.model.entity.Usuario;

public record DispositivoNotificacionPushDTO(
        Long id,
        Usuario.TipoUsuario tipoUsuario,
        DispositivoNotificacionPush.AppFlavor appFlavor,
        DispositivoNotificacionPush.Plataforma plataforma,
        String tokenFingerprint,
        String deviceFingerprint,
        DispositivoNotificacionPush.EstadoDispositivo estado,
        String appVersion,
        String buildType,
        LocalDateTime fechaRegistro,
        LocalDateTime fechaActualizacion,
        LocalDateTime fechaRevocacion
) {
}
