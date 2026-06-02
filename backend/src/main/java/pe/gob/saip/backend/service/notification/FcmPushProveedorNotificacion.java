package pe.gob.saip.backend.service.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class FcmPushProveedorNotificacion implements ProveedorNotificacion {

    private final boolean habilitado;
    private final String serviceAccountPath;
    private final TokenPushProtector tokenProtector;

    public FcmPushProveedorNotificacion(
            @Value("${app.notifications.push.enabled:false}") boolean habilitado,
            @Value("${app.notifications.push.firebase.service-account-path:}") String serviceAccountPath,
            TokenPushProtector tokenProtector) {
        this.habilitado = habilitado;
        this.serviceAccountPath = serviceAccountPath;
        this.tokenProtector = tokenProtector;
    }

    @Override
    public String nombre() {
        return "FCM";
    }

    @Override
    public NotificacionProveedorResultado enviar(NotificacionProveedorRequest request) {
        if (!configurado()) {
            return NotificacionProveedorResultado.noDisponible("FCM_PUSH_NO_CONFIGURADO");
        }
        return NotificacionProveedorResultado.noDisponible(
                "FCM_PUSH_ADAPTER_PREPARADO_PENDIENTE_INTEGRACION_FIREBASE_ADMIN");
    }

    public String estadoSeguro() {
        if (!habilitado) {
            return "DESHABILITADO";
        }
        if (!credencialesExternasConfiguradas() || !tokenProtector.cifradoDisponible()) {
            return "NO_CONFIGURADO";
        }
        return "ADAPTER_PREPARADO_PENDIENTE_FIREBASE_ADMIN";
    }

    public boolean configurado() {
        return habilitado && credencialesExternasConfiguradas() && tokenProtector.cifradoDisponible();
    }

    public boolean credencialesExternasConfiguradas() {
        return serviceAccountPath != null && !serviceAccountPath.isBlank();
    }

    public boolean cifradoTokenConfigurado() {
        return tokenProtector.cifradoDisponible();
    }
}
