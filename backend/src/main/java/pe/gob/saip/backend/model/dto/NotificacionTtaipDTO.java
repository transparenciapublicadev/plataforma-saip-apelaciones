package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;

@Schema(description = "Notificación TTAIP asociada a una cédula y a un destinatario")
public record NotificacionTtaipDTO(
        Long id,
        String numeroCedula,
        String destinatario,
        String destinatarioNombre,
        String destinatarioEmail,
        String fechaNotificacion,
        String medio,
        String estado,
        String detalle
) {
    public static NotificacionTtaipDTO from(NotificacionTtaip notificacion) {
        return new NotificacionTtaipDTO(
                notificacion.getId(),
                notificacion.getCedula() != null ? notificacion.getCedula().getNumeroCedula() : null,
                notificacion.getDestinatario() != null ? notificacion.getDestinatario().name() : null,
                notificacion.getDestinatarioNombre(),
                notificacion.getDestinatarioEmail(),
                notificacion.getFechaNotificacion() != null ? notificacion.getFechaNotificacion().toString() : null,
                notificacion.getMedio(),
                notificacion.getEstado(),
                notificacion.getDetalle()
        );
    }
}
