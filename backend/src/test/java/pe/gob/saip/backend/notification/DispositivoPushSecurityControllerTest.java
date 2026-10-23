package pe.gob.saip.backend.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import pe.gob.saip.backend.controller.DispositivoNotificacionPushRestController;
import pe.gob.saip.backend.exception.GlobalExceptionHandler;
import pe.gob.saip.backend.model.dto.DispositivoNotificacionPushDTO;
import pe.gob.saip.backend.model.dto.RegistrarDispositivoPushRequest;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.service.DispositivoNotificacionPushService;

@ExtendWith(MockitoExtension.class)
class DispositivoPushSecurityControllerTest {

    @Mock
    private DispositivoNotificacionPushService dispositivoService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new DispositivoNotificacionPushRestController(dispositivoService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void registrarTokenVinculaAlUsuarioAutenticadoYNoPermiteSpoofing() throws Exception {
        // El principal usa exclusivamente la identidad persistente autenticada.
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("saip:user:v1:10", null, "ROLE_CIUDADANO"));

        String requestBody = """
                {
                    "token": "validFcmTokenWithSafeChars_1234567890_abcdefghijklmnopqrstuvwxyz",
                    "appFlavor": "CIUDADANO",
                    "plataforma": "ANDROID",
                    "deviceIdHash": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    "appVersion": "1.0.0",
                    "buildType": "debug"
                }
                """;

        DispositivoNotificacionPushDTO expectedDto = new DispositivoNotificacionPushDTO(
                1L,
                pe.gob.saip.backend.model.entity.Usuario.TipoUsuario.CIUDADANO,
                DispositivoNotificacionPush.AppFlavor.CIUDADANO,
                DispositivoNotificacionPush.Plataforma.ANDROID,
                "fingerprint_token",
                "fingerprint_device",
                DispositivoNotificacionPush.EstadoDispositivo.ACTIVO,
                "1.0.0",
                "debug",
                null,
                null,
                null
        );

        // El DTO no aporta identidad y el servicio obtiene al actor del contexto.
        when(dispositivoService.registrar(any(RegistrarDispositivoPushRequest.class)))
                .thenReturn(expectedDto);

        mockMvc.perform(post("/api/notificaciones/push/tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L));

        verify(dispositivoService, times(1)).registrar(any(RegistrarDispositivoPushRequest.class));
    }

    @Test
    void registrarSinAutenticacionRetornaForbiddenRFC9457() throws Exception {
        // Sin autenticación (SecurityContext es null o no autenticado)
        SecurityContextHolder.clearContext();

        String requestBody = """
                {
                    "token": "validFcmTokenWithSafeChars_1234567890_abcdefghijklmnopqrstuvwxyz",
                    "appFlavor": "CIUDADANO",
                    "plataforma": "ANDROID",
                    "deviceIdHash": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                    "appVersion": "1.0.0",
                    "buildType": "debug"
                }
                """;

        mockMvc.perform(post("/api/notificaciones/push/tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden())
                .andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("urn:saip:problem:forbidden"))
                .andExpect(jsonPath("$.title").value("Forbidden"))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.detail").value("El usuario autenticado no tiene permisos para ejecutar esta operación."));

        verifyNoInteractions(dispositivoService);
    }
}
