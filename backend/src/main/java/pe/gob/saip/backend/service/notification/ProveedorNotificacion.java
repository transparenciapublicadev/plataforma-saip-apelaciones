package pe.gob.saip.backend.service.notification;

public interface ProveedorNotificacion {

    String nombre();

    NotificacionProveedorResultado enviar(NotificacionProveedorRequest request);
}
