package pe.gob.saip.backend.service.notification;

import org.springframework.stereotype.Component;

@Component
public class CasillaElectronicaProveedorNotificacion implements ProveedorNotificacion {

    @Override
    public String nombre() {
        return "CASILLA_ELECTRONICA";
    }

    @Override
    public NotificacionProveedorResultado enviar(NotificacionProveedorRequest request) {
        return NotificacionProveedorResultado.noDisponible(
                "CASILLA_ELECTRONICA_PENDIENTE_CONTRATO_API_OFICIAL"
        );
    }
}
