package pe.gob.saip.backend.service.notification;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.google.firebase.messaging.MessagingErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.repository.DispositivoNotificacionPushRepository;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

@Component
public class FcmPushProveedorNotificacion implements ProveedorNotificacion {

    private static final Pattern TOKEN_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\-\\.:]+$");

    private final boolean habilitado;
    private final String credentialsJson;
    private final TokenPushProtector tokenProtector;
    private final DispositivoNotificacionPushRepository dispositivoRepository;

    public FcmPushProveedorNotificacion(
            @Value("${app.notifications.push.enabled:false}") boolean habilitado,
            @Value("${app.notifications.push.firebase.credentials-json:}") String credentialsJson,
            TokenPushProtector tokenProtector,
            DispositivoNotificacionPushRepository dispositivoRepository) {
        this.habilitado = habilitado;
        this.credentialsJson = credentialsJson;
        this.tokenProtector = tokenProtector;
        this.dispositivoRepository = dispositivoRepository;
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

        List<DispositivoNotificacionPush> dispositivos = dispositivoRepository
                .findByUsuario_EmailAndEstado(request.destinatario(), DispositivoNotificacionPush.EstadoDispositivo.ACTIVO);

        if (dispositivos.isEmpty()) {
            return NotificacionProveedorResultado.noDisponible("FCM_PUSH_SIN_DISPOSITIVOS_ACTIVOS");
        }

        final FirebaseMessaging messaging = FirebaseMessaging.getInstance();

        List<java.util.concurrent.CompletableFuture<EnvioResultado>> futures = dispositivos.stream()
                .map(dispositivo -> {
                    String tokenCifrado = dispositivo.getTokenCifrado();
                    String tokenReal = validarYSanitizarToken(tokenCifrado);

                    if (tokenReal == null) {
                        return java.util.concurrent.CompletableFuture.completedFuture(
                                new EnvioResultado(dispositivo, null, null, "Token inválido o malformado durante sanitización", true));
                    }

                    return java.util.concurrent.CompletableFuture.supplyAsync(() -> {
                        try {
                            Message message = Message.builder()
                                    .setToken(tokenReal)
                                    .setNotification(Notification.builder()
                                            .setTitle(request.asunto())
                                            .setBody(request.contenido())
                                            .build())
                                    .build();

                            String messageId = messaging.send(message);
                            return new EnvioResultado(dispositivo, messageId, null, null, false);
                        } catch (FirebaseMessagingException e) {
                            boolean isUnregistered = e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED
                                    || "UNREGISTERED".equals(e.getErrorCode())
                                    || (e.getMessage() != null && e.getMessage().contains("registration-token-not-registered"));
                            return new EnvioResultado(dispositivo, null, e, e.getMessage(), isUnregistered);
                        } catch (Exception e) {
                            return new EnvioResultado(dispositivo, null, e, e.getMessage(), false);
                        }
                    });
                })
                .toList();

        // Wait for all tasks to complete
        java.util.concurrent.CompletableFuture.allOf(futures.toArray(new java.util.concurrent.CompletableFuture[0])).join();

        int exitos = 0;
        String ultimoError = null;
        String ultimoCodigoEnvio = null;

        for (java.util.concurrent.CompletableFuture<EnvioResultado> future : futures) {
            EnvioResultado result = future.join();
            if (result.exito()) {
                exitos++;
                ultimoCodigoEnvio = result.messageId();
            } else {
                ultimoError = result.errorMessage();
                if (result.debeRevocar()) {
                    String motivo = result.exception() instanceof FirebaseMessagingException
                            ? "Token revocado por error de registro en Firebase: " + result.errorMessage()
                            : result.errorMessage();
                    revocarDispositivo(result.dispositivo(), motivo);
                }
            }
        }

        if (exitos > 0) {
            return NotificacionProveedorResultado.enviado(ultimoCodigoEnvio, null, null);
        } else {
            return NotificacionProveedorResultado.fallido(ultimoError != null ? ultimoError : "TODOS_LOS_ENVIO_FALLARON");
        }
    }

    private String validarYSanitizarToken(String tokenCifrado) {
        if (tokenCifrado == null || tokenCifrado.isBlank()) {
            return null;
        }

        String token = tokenProtector.descifrarSiDisponible(tokenCifrado);
        if (token == null || token.isBlank()) {
            return null;
        }

        token = token.trim();

        if (token.length() < 20 || token.length() > 1024) {
            return null;
        }

        if (!TOKEN_PATTERN.matcher(token).matches()) {
            return null;
        }

        return token;
    }

    private void revocarDispositivo(DispositivoNotificacionPush dispositivo, String motivo) {
        dispositivo.setEstado(DispositivoNotificacionPush.EstadoDispositivo.REVOCADO);
        dispositivo.setFechaRevocacion(LocalDateTime.now());
        dispositivo.setTrazabilidad(anexarTrazabilidad(dispositivo.getTrazabilidad(), motivo));
        dispositivoRepository.save(dispositivo);
    }

    private String anexarTrazabilidad(String actual, String nuevoValor) {
        return actual == null || actual.isBlank() ? nuevoValor : actual + System.lineSeparator() + nuevoValor;
    }

    public String estadoSeguro() {
        if (!habilitado) {
            return "DESHABILITADO";
        }
        if (!credencialesExternasConfiguradas() || !tokenProtector.cifradoDisponible()) {
            return "NO_CONFIGURADO";
        }
        if (FirebaseApp.getApps().isEmpty()) {
            return "NO_INICIALIZADO";
        }
        return "ADAPTER_PREPARADO";
    }

    public boolean configurado() {
        return habilitado 
                && credencialesExternasConfiguradas() 
                && tokenProtector.cifradoDisponible() 
                && !FirebaseApp.getApps().isEmpty();
    }

    public boolean credencialesExternasConfiguradas() {
        return credentialsJson != null && !credentialsJson.isBlank();
    }

    public boolean cifradoTokenConfigurado() {
        return tokenProtector.cifradoDisponible();
    }

    private static record EnvioResultado(
            DispositivoNotificacionPush dispositivo,
            String messageId,
            Exception exception,
            String errorMessage,
            boolean debeRevocar
    ) {
        public boolean exito() {
            return messageId != null;
        }
    }
}
