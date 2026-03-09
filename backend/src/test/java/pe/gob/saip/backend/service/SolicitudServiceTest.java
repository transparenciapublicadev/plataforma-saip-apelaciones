package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.SolicitudRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SolicitudServiceTest {

    @Mock
    SolicitudRepository solicitudRepository;

    @InjectMocks
    SolicitudService solicitudService;

    private Solicitud crearSolicitud(Long id, String expediente, Solicitud.EstadoSolicitud estado) {
        Solicitud s = new Solicitud();
        s.setIdSolicitud(id);
        s.setExpediente(expediente);
        s.setAsunto("Solicitud de prueba");
        s.setDescripcion("Descripción de prueba");
        s.setEstado(estado);
        s.setFechaPresentacion(LocalDateTime.now());
        s.setFechaLimite(LocalDate.now().plusDays(10));
        return s;
    }

    @Test
    void obtenerTodasLasSolicitudes_debeRetornarLista() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA),
            crearSolicitud(2L, "SAIP-2025-00002", Solicitud.EstadoSolicitud.EN_REVISION)
        );
        when(solicitudRepository.findAll()).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.obtenerTodasLasSolicitudes();

        assertThat(resultado).hasSize(2);
        verify(solicitudRepository).findAll();
    }

    @Test
    void obtenerSolicitudPorId_existente_debeRetornarPresente() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findById(1L)).thenReturn(Optional.of(solicitud));

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorId(1L);

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getExpediente()).isEqualTo("SAIP-2025-00001");
    }

    @Test
    void obtenerSolicitudPorId_noExistente_debeRetornarVacio() {
        when(solicitudRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorId(999L);

        assertThat(resultado).isEmpty();
    }

    @Test
    void obtenerSolicitudPorExpediente_debeRetornarSolicitud() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findByExpediente("SAIP-2025-00001")).thenReturn(Optional.of(solicitud));

        Optional<Solicitud> resultado = solicitudService.obtenerSolicitudPorExpediente("SAIP-2025-00001");

        assertThat(resultado).isPresent();
        assertThat(resultado.get().getId()).isEqualTo(1L);
    }

    @Test
    void findByCiudadanoId_debeRetornarSolicitudesDelCiudadano() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA)
        );
        when(solicitudRepository.findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(10L)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.findByCiudadanoId(10L);

        assertThat(resultado).hasSize(1);
        verify(solicitudRepository).findByCiudadano_IdUsuarioOrderByFechaPresentacionDesc(10L);
    }

    @Test
    void findByEntidadId_debeRetornarSolicitudesDeLaEntidad() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.EN_REVISION),
            crearSolicitud(2L, "SAIP-2025-00002", Solicitud.EstadoSolicitud.RECEPCIONADA)
        );
        when(solicitudRepository.findByEntidad_IdEntidadOrderByFechaPresentacionDesc(5L)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.findByEntidadId(5L);

        assertThat(resultado).hasSize(2);
    }

    @Test
    void obtenerSolicitudesPorEstado_debeRetornarFiltradasPorEstado() {
        var solicitudes = List.of(
            crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.VENCIDA)
        );
        when(solicitudRepository.findByEstado(Solicitud.EstadoSolicitud.VENCIDA)).thenReturn(solicitudes);

        List<Solicitud> resultado = solicitudService.obtenerSolicitudesPorEstado(Solicitud.EstadoSolicitud.VENCIDA);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstado()).isEqualTo(Solicitud.EstadoSolicitud.VENCIDA);
    }

    @Test
    void contarSolicitudesPorEstado_debeRetornarCuenta() {
        when(solicitudRepository.countByEstado(Solicitud.EstadoSolicitud.RECEPCIONADA)).thenReturn(15L);

        long resultado = solicitudService.contarSolicitudesPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);

        assertThat(resultado).isEqualTo(15L);
    }

    @Test
    void generarExpediente_sinSolicitudesPrevias_debeGenerarPrimero() {
        int year = LocalDate.now().getYear();
        String prefix = "SAIP-" + year + "-";
        when(solicitudRepository.findMaxExpedienteNumber(prefix + "%")).thenReturn(null);

        String expediente = solicitudService.generarExpediente();

        assertThat(expediente).isEqualTo(prefix + "00001");
    }

    @Test
    void generarExpediente_conSolicitudesPrevias_debeIncrementar() {
        int year = LocalDate.now().getYear();
        String prefix = "SAIP-" + year + "-";
        when(solicitudRepository.findMaxExpedienteNumber(prefix + "%")).thenReturn(42);

        String expediente = solicitudService.generarExpediente();

        assertThat(expediente).isEqualTo(prefix + "00043");
    }

    @Test
    void save_sinExpediente_debeGenerarExpediente() {
        Solicitud solicitud = crearSolicitud(null, null, Solicitud.EstadoSolicitud.RECEPCIONADA);
        int year = LocalDate.now().getYear();
        when(solicitudRepository.findMaxExpedienteNumber(anyString())).thenReturn(null);
        when(solicitudRepository.save(any())).thenAnswer(inv -> {
            Solicitud s = inv.getArgument(0);
            s.setIdSolicitud(1L);
            return s;
        });

        Solicitud resultado = solicitudService.save(solicitud);

        assertThat(resultado.getExpediente()).startsWith("SAIP-" + year + "-");
        verify(solicitudRepository).save(solicitud);
    }

    @Test
    void save_conExpediente_noDebeRegenerar() {
        Solicitud solicitud = crearSolicitud(1L, "SAIP-2025-00010", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.save(solicitud)).thenReturn(solicitud);

        Solicitud resultado = solicitudService.save(solicitud);

        assertThat(resultado.getExpediente()).isEqualTo("SAIP-2025-00010");
        verify(solicitudRepository, never()).findMaxExpedienteNumber(anyString());
    }

    @Test
    void detectarSilencioAdministrativo_debeMarcarComoVencidas() {
        var solicitud = crearSolicitud(1L, "SAIP-2025-00001", Solicitud.EstadoSolicitud.RECEPCIONADA);
        when(solicitudRepository.findVencidas(any(LocalDate.class), anyList())).thenReturn(List.of(solicitud));
        when(solicitudRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        List<Solicitud> resultado = solicitudService.detectarSilencioAdministrativo();

        assertThat(resultado).hasSize(1);
        assertThat(resultado.getFirst().getEstado()).isEqualTo(Solicitud.EstadoSolicitud.VENCIDA);
    }

    @Test
    void eliminarSolicitud_debeInvocarDeleteById() {
        solicitudService.eliminarSolicitud(1L);

        verify(solicitudRepository).deleteById(1L);
    }

    @Test
    void count_debeRetornarCuenta() {
        when(solicitudRepository.count()).thenReturn(25L);

        long resultado = solicitudService.count();

        assertThat(resultado).isEqualTo(25L);
    }

    @Test
    void countByEntidadIdAndEstado_debeConvertirEstadoYContar() {
        when(solicitudRepository.countByEntidadAndEstado(eq(5L), eq(Solicitud.EstadoSolicitud.EN_REVISION)))
                .thenReturn(3L);

        long resultado = solicitudService.countByEntidadIdAndEstado(5L, "EN_REVISION");

        assertThat(resultado).isEqualTo(3L);
    }

    @Test
    void countByEntidadIdAndEstado_estadoInvalido_debeUsarRecepcionada() {
        when(solicitudRepository.countByEntidadAndEstado(eq(5L), eq(Solicitud.EstadoSolicitud.RECEPCIONADA)))
                .thenReturn(1L);

        long resultado = solicitudService.countByEntidadIdAndEstado(5L, "INVALIDO");

        assertThat(resultado).isEqualTo(1L);
    }
}
