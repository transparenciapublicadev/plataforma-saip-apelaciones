package pe.gob.saip.backend.service.notification;

import pe.gob.saip.backend.model.entity.IntentoNotificacion;

public record NotificacionProveedorRequest(
        String codigoCorrelacion,
        IntentoNotificacion.CanalEnvio canal,
        String destinatario,
        String asunto,
        String contenido,
        boolean forzarFalloMock
) {
}
