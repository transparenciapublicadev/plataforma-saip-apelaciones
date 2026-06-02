package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Estado seguro del motor de notificaciones; nunca expone credenciales")
public record EstadoMotorNotificacionesDTO(
        String modo,
        boolean mockDisponible,
        boolean smtpConfigurable,
        boolean smtpHostConfigurado,
        String casillaElectronicaEstado,
        boolean fcmConfigurable,
        String fcmEstado,
        boolean cifradoTokenPushConfigurado,
        String nota
) {
}
