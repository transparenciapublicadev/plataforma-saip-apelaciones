package pe.gob.saip.backend.scheduler;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.service.*;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Unit tests with mocks; persisted deadlines and contention are tested with PostgreSQL. */
@ExtendWith(MockitoExtension.class)
class PlazoAlertaSchedulerTest {
    @Mock SolicitudService solicitudService;
    @Mock MotorNotificacionesService motorNotificacionesService;
    @Mock SubsanacionTtaipService subsanacionTtaipService;
    @InjectMocks PlazoAlertaScheduler scheduler;

    @Test void sinVencimientosNoEnviaNotificaciones() {
        when(solicitudService.detectarSilencioAdministrativo()).thenReturn(List.of());
        scheduler.procesarAuditoriaDePlazos();
        verify(solicitudService).detectarSilencioAdministrativo();
        verifyNoInteractions(motorNotificacionesService);
    }
    @Test void notificacionFallidaNoImpideIntentarLosOtrosVencimientosPersistidos() {
        Solicitud uno=new Solicitud(); uno.setIdSolicitud(1L);
        Solicitud dos=new Solicitud(); dos.setIdSolicitud(2L);
        when(solicitudService.detectarSilencioAdministrativo()).thenReturn(List.of(uno,dos));
        when(motorNotificacionesService.enviarNotificacionSaip(eq(1L),any())).thenThrow(new IllegalArgumentException("Fallo sintético"));
        scheduler.procesarAuditoriaDePlazos();
        verify(motorNotificacionesService).enviarNotificacionSaip(eq(1L),any());
        verify(motorNotificacionesService).enviarNotificacionSaip(eq(2L),any());
    }
}
