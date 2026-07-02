package pe.gob.saip.backend.scheduler;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.MotorNotificacionesService;
import pe.gob.saip.backend.service.PlazoCalculadorService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PlazoAlertaSchedulerTest {

    @Mock
    private SolicitudRepository solicitudRepository;

    @Mock
    private PlazoCalculadorService plazoCalculadorService;

    @Mock
    private MotorNotificacionesService motorNotificacionesService;

    @InjectMocks
    private PlazoAlertaScheduler plazoAlertaScheduler;

    @Test
    void procesarAuditoriaDePlazos_cuandoNoHaySolicitudesActivas_noHaceNada() {
        when(solicitudRepository.findByEstadoIn(any())).thenReturn(Collections.emptyList());

        plazoAlertaScheduler.procesarAuditoriaDePlazos();

        verify(solicitudRepository).findByEstadoIn(any());
        verifyNoInteractions(plazoCalculadorService);
        verifyNoInteractions(motorNotificacionesService);
    }

    @Test
    void procesarAuditoriaDePlazos_cuandoHaySolicitudes_venceSoloLasExcedidas() {
        // Solicitud 1: Excedida (vencida)
        Solicitud s1 = new Solicitud();
        s1.setIdSolicitud(1L);
        s1.setExpediente("SAIP-2026-00001");
        s1.setEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);
        LocalDateTime fechaPres1 = LocalDateTime.now().minusDays(15);
        s1.setFechaPresentacion(fechaPres1);
        
        Entidad entidad1 = new Entidad();
        entidad1.setIdEntidad(100L);
        entidad1.setNombre("MINISTERIO DE JUSTICIA");
        s1.setEntidad(entidad1);

        // Solicitud 2: Dentro del plazo
        Solicitud s2 = new Solicitud();
        s2.setIdSolicitud(2L);
        s2.setExpediente("SAIP-2026-00002");
        s2.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        LocalDateTime fechaPres2 = LocalDateTime.now().minusDays(2);
        s2.setFechaPresentacion(fechaPres2);
        
        Entidad entidad2 = new Entidad();
        entidad2.setIdEntidad(101L);
        entidad2.setNombre("MINISTERIO DEL INTERIOR");
        s2.setEntidad(entidad2);

        when(solicitudRepository.findByEstadoIn(any())).thenReturn(Arrays.asList(s1, s2));

        // Mock del calculador para s1: vencimiento hace 5 días (días restantes <= 0)
        LocalDate v1 = LocalDate.now().minusDays(5);
        when(plazoCalculadorService.calcularFechaVencimiento(eq(fechaPres1.toLocalDate()), eq(10)))
                .thenReturn(v1);

        // Mock del calculador para s2: vencimiento en 8 días (días restantes > 0)
        LocalDate v2 = LocalDate.now().plusDays(8);
        when(plazoCalculadorService.calcularFechaVencimiento(eq(fechaPres2.toLocalDate()), eq(10)))
                .thenReturn(v2);

        plazoAlertaScheduler.procesarAuditoriaDePlazos();

        // Verificaciones para s1
        assertThat(s1.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.VENCIDA);
        verify(solicitudRepository).save(s1);
        verify(motorNotificacionesService).enviarNotificacionSaip(eq(1L), any());

        // Verificaciones para s2
        assertThat(s2.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.EN_REVISION);
        verify(solicitudRepository, never()).save(s2);
        verify(motorNotificacionesService, never()).enviarNotificacionSaip(eq(2L), any());
    }
}
