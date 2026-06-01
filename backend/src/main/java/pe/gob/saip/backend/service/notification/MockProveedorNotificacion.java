package pe.gob.saip.backend.service.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MockProveedorNotificacion implements ProveedorNotificacion {

    private final boolean permitirFalloForzado;

    public MockProveedorNotificacion(
            @Value("${app.notifications.mock.allow-forced-failure:true}") boolean permitirFalloForzado) {
        this.permitirFalloForzado = permitirFalloForzado;
    }

    @Override
    public String nombre() {
        return "MOCK";
    }

    @Override
    public NotificacionProveedorResultado enviar(NotificacionProveedorRequest request) {
        if (request.forzarFalloMock()) {
            if (!permitirFalloForzado) {
                return NotificacionProveedorResultado.fallido("MOCK_FORCED_FAILURE_DISABLED");
            }
            return NotificacionProveedorResultado.fallido("MOCK_PROVIDER_CONTROLLED_FAILURE");
        }

        String codigo = "MOCK-" + request.codigoCorrelacion();
        return NotificacionProveedorResultado.entregado(
                codigo,
                "CONST-" + codigo,
                "Constancia mock de entrega para validación local.",
                "Acuse mock automático: entrega confirmada."
        );
    }
}
