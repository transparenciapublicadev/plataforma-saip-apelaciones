package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import pe.gob.saip.backend.model.dto.RegistrarDispositivoPushRequest;
import pe.gob.saip.backend.model.dto.RevocarDispositivoPushActualRequest;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.DispositivoNotificacionPushRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.service.notification.FcmPushProveedorNotificacion;
import pe.gob.saip.backend.service.notification.TokenPushProtector;

@ExtendWith(MockitoExtension.class)
class DispositivoNotificacionPushServiceTest {

    private static final String DEVICE_HASH = "a".repeat(64);

    @Mock
    private DispositivoNotificacionPushRepository dispositivoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    private DispositivoNotificacionPushService service;
    private Usuario ciudadano;

    @BeforeEach
    void setUp() {
        TokenPushProtector protector = new TokenPushProtector("");
        service = new DispositivoNotificacionPushService(
                dispositivoRepository,
                usuarioRepository,
                protector,
                new FcmPushProveedorNotificacion(false, "", protector, dispositivoRepository));
        ciudadano = new Usuario();
        ciudadano.setIdUsuario(10L);
        ciudadano.setEmail("ciudadano@example.test");
        ciudadano.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        autenticar("saip:user:v1:10", "ROLE_CIUDADANO");
        when(usuarioRepository.findById(10L)).thenReturn(Optional.of(ciudadano));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void registrarTokenPersisteSoloHashCuandoNoExisteClaveExterna() {
        when(dispositivoRepository.findByUsuario_IdUsuarioAndDeviceIdHashAndAppFlavorAndEstado(
                any(), any(), any(), any())).thenReturn(List.of());
        when(dispositivoRepository.findByTokenHash(any())).thenReturn(Optional.empty());
        when(dispositivoRepository.save(any())).thenAnswer(invocation -> {
            DispositivoNotificacionPush dispositivo = invocation.getArgument(0);
            assertThat(dispositivo.getTokenHash()).hasSize(64);
            assertThat(dispositivo.getTokenHash()).doesNotContain("fake-fcm-token");
            assertThat(dispositivo.getTokenCifrado()).isNull();
            dispositivo.setIdDispositivoPush(99L);
            return dispositivo;
        });

        var dto = service.registrar(request(DispositivoNotificacionPush.AppFlavor.CIUDADANO));

        assertThat(dto.id()).isEqualTo(99L);
        assertThat(dto.tokenFingerprint()).hasSize(12);
        verify(dispositivoRepository).save(any(DispositivoNotificacionPush.class));
    }

    @Test
    void registrarTokenRechazaFlavorQueNoCorrespondeAlRolAutenticado() {
        assertThatThrownBy(() -> service.registrar(request(DispositivoNotificacionPush.AppFlavor.TTAIP)))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("flavor mobile");
    }

    @Test
    void revocarActualMantieneLogoutIdempotenteSiNoHayTokenActivo() {
        when(dispositivoRepository.findByUsuario_IdUsuarioAndDeviceIdHashAndEstado(
                10L, DEVICE_HASH, DispositivoNotificacionPush.EstadoDispositivo.ACTIVO))
                .thenReturn(List.of());

        service.revocarActual(new RevocarDispositivoPushActualRequest(DEVICE_HASH));

        verify(dispositivoRepository).findByUsuario_IdUsuarioAndDeviceIdHashAndEstado(
                10L, DEVICE_HASH, DispositivoNotificacionPush.EstadoDispositivo.ACTIVO);
    }

    private RegistrarDispositivoPushRequest request(DispositivoNotificacionPush.AppFlavor flavor) {
        return new RegistrarDispositivoPushRequest(
                "fake-fcm-token-for-unit-test-123456789",
                flavor,
                DispositivoNotificacionPush.Plataforma.ANDROID,
                DEVICE_HASH,
                "1.0.0",
                "debug");
    }

    private void autenticar(String email, String role) {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken(email, null, role));
    }
}
