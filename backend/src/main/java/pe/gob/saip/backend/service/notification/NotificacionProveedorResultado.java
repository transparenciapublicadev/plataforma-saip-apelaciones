package pe.gob.saip.backend.service.notification;

import pe.gob.saip.backend.model.entity.IntentoNotificacion;

public record NotificacionProveedorResultado(
        IntentoNotificacion.EstadoIntento estado,
        String codigoEnvio,
        String codigoConstancia,
        String constanciaEnvio,
        String acuseAutomatico,
        String estadoAcuse,
        String mensajeTecnicoSanitizado
) {
    public static NotificacionProveedorResultado entregado(String codigoEnvio,
                                                           String codigoConstancia,
                                                           String constanciaEnvio,
                                                           String acuseAutomatico) {
        return new NotificacionProveedorResultado(
                IntentoNotificacion.EstadoIntento.ENTREGADO,
                codigoEnvio,
                codigoConstancia,
                constanciaEnvio,
                acuseAutomatico,
                "ENTREGADO",
                null
        );
    }

    public static NotificacionProveedorResultado enviado(String codigoEnvio,
                                                         String codigoConstancia,
                                                         String constanciaEnvio) {
        return new NotificacionProveedorResultado(
                IntentoNotificacion.EstadoIntento.ENVIADO,
                codigoEnvio,
                codigoConstancia,
                constanciaEnvio,
                null,
                "PENDIENTE",
                null
        );
    }

    public static NotificacionProveedorResultado fallido(String mensajeTecnicoSanitizado) {
        return new NotificacionProveedorResultado(
                IntentoNotificacion.EstadoIntento.FALLIDO,
                null,
                null,
                null,
                null,
                "FALLIDO",
                mensajeTecnicoSanitizado
        );
    }

    public static NotificacionProveedorResultado noDisponible(String mensajeTecnicoSanitizado) {
        return new NotificacionProveedorResultado(
                IntentoNotificacion.EstadoIntento.NO_DISPONIBLE,
                null,
                null,
                null,
                null,
                "NO_DISPONIBLE",
                mensajeTecnicoSanitizado
        );
    }
}
