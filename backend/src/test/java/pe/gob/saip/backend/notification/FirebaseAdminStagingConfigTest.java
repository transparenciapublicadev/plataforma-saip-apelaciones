package pe.gob.saip.backend.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush.EstadoDispositivo;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;
import pe.gob.saip.backend.repository.DispositivoNotificacionPushRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.service.notification.FcmPushProveedorNotificacion;
import pe.gob.saip.backend.service.notification.NotificacionProveedorRequest;
import pe.gob.saip.backend.service.notification.NotificacionProveedorResultado;
import pe.gob.saip.backend.service.notification.TokenPushProtector;

import java.util.Optional;

@SpringBootTest(properties = {
    "app.storage.provider=local",
    "app.notifications.push.enabled=true",
    "app.notifications.push.firebase.credentials-json={}",
    "app.notifications.push.token-encryption-key-base64=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
    "spring.flyway.enabled=false"
})
@ActiveProfiles("staging")
@Transactional
public class FirebaseAdminStagingConfigTest {

    @DynamicPropertySource
    static void isolatedJwt(DynamicPropertyRegistry registry) {
        String key = java.util.UUID.randomUUID().toString() + java.util.UUID.randomUUID();
        registry.add("JWT_SECRET", () -> key);
    }


    @Autowired
    private FcmPushProveedorNotificacion pushProveedor;

    @Autowired(required = false)
    private FirebaseApp firebaseApp;

    @Autowired
    private TokenPushProtector tokenProtector;

    @Autowired
    private DispositivoNotificacionPushRepository dispositivoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    public void testFirebaseAppBeanIsNullWhenCredentialsEmpty() {
        assertThat(firebaseApp).isNull();
    }

    @Test
    public void testTokenSanitizationFiltersInvalidTokens() {
        try (MockedStatic<FirebaseMessaging> mockedMessaging = mockStatic(FirebaseMessaging.class);
             MockedStatic<FirebaseApp> mockedApp = mockStatic(FirebaseApp.class)) {
            
            mockedApp.when(FirebaseApp::getApps).thenReturn(java.util.Collections.singletonList(mock(FirebaseApp.class)));
            FirebaseMessaging mockInstance = mock(FirebaseMessaging.class);
            mockedMessaging.when(FirebaseMessaging::getInstance).thenReturn(mockInstance);

            Usuario usuario = saveTestUsuario("test-sanitization@saip.gob.pe");

            DispositivoNotificacionPush dispositivo = new DispositivoNotificacionPush();
            dispositivo.setUsuario(usuario);
            dispositivo.setTipoUsuario(usuario.getTipoUsuario());
            dispositivo.setAppFlavor(DispositivoNotificacionPush.AppFlavor.CIUDADANO);
            dispositivo.setPlataforma(DispositivoNotificacionPush.Plataforma.ANDROID);
            
            // Token has spaces and script tag (injection payload)
            String tokenInvalido = "invalid token with spaces and <script>alert(1)</script>";
            dispositivo.setTokenCifrado(tokenProtector.cifrarSiDisponible(tokenInvalido));
            dispositivo.setTokenHash(tokenProtector.hash(tokenInvalido));
            dispositivo.setDeviceIdHash("device-id-hash-sanit");
            dispositivo.setEstado(EstadoDispositivo.ACTIVO);
            dispositivo = dispositivoRepository.save(dispositivo);

            NotificacionProveedorRequest req = new NotificacionProveedorRequest(
                    "CORR-SAN", IntentoNotificacion.CanalEnvio.PUSH_FCM, "test-sanitization@saip.gob.pe", "Asunto", "Contenido", false);
            
            NotificacionProveedorResultado res = pushProveedor.enviar(req);

            // Since the only token was invalid, no message was sent
            assertThat(res.estado()).isEqualTo(IntentoNotificacion.EstadoIntento.FALLIDO);

            // Verify the device token was automatically marked as REVOCADO due to failed sanitization
            Optional<DispositivoNotificacionPush> updated = dispositivoRepository.findById(dispositivo.getIdDispositivoPush());
            assertThat(updated).isPresent();
            assertThat(updated.get().getEstado()).isEqualTo(EstadoDispositivo.REVOCADO);
            assertThat(updated.get().getTrazabilidad()).contains("Token inválido o malformado durante sanitización");
        }
    }

    @Test
    public void testTokenRevocationOnUnregisteredFirebaseError() throws Exception {
        Usuario usuario = saveTestUsuario("test-revocation@saip.gob.pe");

        DispositivoNotificacionPush dispositivo = new DispositivoNotificacionPush();
        dispositivo.setUsuario(usuario);
        dispositivo.setTipoUsuario(usuario.getTipoUsuario());
        dispositivo.setAppFlavor(DispositivoNotificacionPush.AppFlavor.CIUDADANO);
        dispositivo.setPlataforma(DispositivoNotificacionPush.Plataforma.ANDROID);
        
        // Valid token structure but unregistered
        String validToken = "validFcmTokenWithSafeChars_1234567890_abcdefghijklmnopqrstuvwxyz";
        dispositivo.setTokenCifrado(tokenProtector.cifrarSiDisponible(validToken));
        dispositivo.setTokenHash(tokenProtector.hash(validToken));
        dispositivo.setDeviceIdHash("device-id-hash-revocation");
        dispositivo.setEstado(EstadoDispositivo.ACTIVO);
        dispositivo = dispositivoRepository.save(dispositivo);

        // Mock static FirebaseMessaging and FirebaseApp
        try (MockedStatic<FirebaseMessaging> mockedMessaging = mockStatic(FirebaseMessaging.class);
             MockedStatic<FirebaseApp> mockedApp = mockStatic(FirebaseApp.class)) {
            
            mockedApp.when(FirebaseApp::getApps).thenReturn(java.util.Collections.singletonList(mock(FirebaseApp.class)));
            
            FirebaseMessaging mockInstance = mock(FirebaseMessaging.class);
            mockedMessaging.when(FirebaseMessaging::getInstance).thenReturn(mockInstance);
            
            FirebaseMessagingException exception = createFirebaseMessagingException("UNREGISTERED", "Token is unregistered");
            
            when(mockInstance.send(any(com.google.firebase.messaging.Message.class)))
                    .thenThrow(exception);
            
            NotificacionProveedorRequest req = new NotificacionProveedorRequest(
                    "CORR-REV", IntentoNotificacion.CanalEnvio.PUSH_FCM, "test-revocation@saip.gob.pe", "Asunto", "Contenido", false);
            
            NotificacionProveedorResultado res = pushProveedor.enviar(req);
            
            assertThat(res.estado()).isEqualTo(IntentoNotificacion.EstadoIntento.FALLIDO);
            
            // Verify device was revoked in DB
            Optional<DispositivoNotificacionPush> updated = dispositivoRepository.findById(dispositivo.getIdDispositivoPush());
            assertThat(updated).isPresent();
            assertThat(updated.get().getEstado()).isEqualTo(EstadoDispositivo.REVOCADO);
            assertThat(updated.get().getFechaRevocacion()).isNotNull();
            assertThat(updated.get().getTrazabilidad()).contains("Token revocado por error de registro en Firebase");
        }
    }

    private Usuario saveTestUsuario(String email) {
        Usuario usuario = new Usuario();
        usuario.setEmail(email);
        usuario.setPassword("encodedPassword");
        usuario.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        usuario.setActivo(true);
        return usuarioRepository.save(usuario);
    }

    private FirebaseMessagingException createFirebaseMessagingException(String errorCodeStr, String messageStr) {
        try {
            java.lang.reflect.Constructor<FirebaseMessagingException> constructor =
                    FirebaseMessagingException.class.getDeclaredConstructor(
                            com.google.firebase.ErrorCode.class,
                            String.class
                    );
            constructor.setAccessible(true);
            FirebaseMessagingException exception = constructor.newInstance(
                    com.google.firebase.ErrorCode.INVALID_ARGUMENT,
                    messageStr
            );
            
            java.lang.reflect.Field field = FirebaseMessagingException.class.getDeclaredField("errorCode");
            field.setAccessible(true);
            field.set(exception, com.google.firebase.messaging.MessagingErrorCode.UNREGISTERED);
            
            return exception;
        } catch (Exception e) {
            throw new RuntimeException("Could not create FirebaseMessagingException for test", e);
        }
    }
}
