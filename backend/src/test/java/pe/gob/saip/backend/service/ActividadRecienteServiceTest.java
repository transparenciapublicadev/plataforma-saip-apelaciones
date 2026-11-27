package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.ActividadRecienteDTO;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Solicitud;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActividadRecienteServiceTest {

    @Mock
    SolicitudService solicitudService;

    @Mock
    ApelacionService apelacionService;

    @InjectMocks
    ActividadRecienteService service;

    @Test
    void incluyeLaSolicitudVencidaYLaResolucionFinalSinRecorrerCalificacionesPrevias() {
        Entidad entidad = new Entidad();
        entidad.setNombre("Ministerio de Educación");

        Solicitud solicitud = new Solicitud();
        solicitud.setExpediente("SAIP-2026-10008");
        solicitud.setEntidad(entidad);
        solicitud.setEstado(Solicitud.EstadoSolicitud.VENCIDA);
        solicitud.setFechaPresentacion(LocalDateTime.of(2026, 11, 1, 9, 0));
        solicitud.setFechaLimite(LocalDate.of(2026, 11, 16));

        Resolucion calificacion = new Resolucion();
        calificacion.setTipoResolucion(Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
        calificacion.setFechaResolucion(LocalDateTime.of(2026, 11, 20, 10, 0));

        Resolucion final_ = new Resolucion();
        final_.setTipoResolucion(Resolucion.TipoResolucion.RESOLUCION_FINAL);
        final_.setFechaResolucion(LocalDateTime.of(2026, 11, 24, 15, 30));

        Apelacion apelacion = new Apelacion();
        apelacion.setExpediente("00004-2026-JUS/TTAIP");
        apelacion.setEntidadExternaNombre("Ministerio de Educación");
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);
        apelacion.setFechaApelacion(LocalDateTime.of(2026, 11, 10, 8, 0));
        apelacion.setResoluciones(List.of(calificacion, final_));

        when(solicitudService.obtenerTodasLasSolicitudes()).thenReturn(List.of(solicitud));
        when(apelacionService.findAll()).thenReturn(List.of(apelacion));

        List<ActividadRecienteDTO> eventos = service.listar(10);

        assertThat(eventos).extracting(ActividadRecienteDTO::label)
                .containsExactly(
                        "Resolución TTAIP emitida",
                        "Solicitud vencida detectada",
                        "Apelación presentada",
                        "Solicitud SAIP registrada");
        assertThat(eventos.get(0).detail()).contains("00004-2026-JUS/TTAIP").contains("2026-11-24");
        assertThat(eventos.get(1).detail()).contains("SAIP-2026-10008").contains("2026-11-16");
        assertThat(eventos.get(2).detail()).contains("2026-11-10");
        assertThat(eventos).noneMatch(evento -> evento.detail().contains("2026-11-20"));
    }
}
