package pe.gob.saip.backend.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import pe.gob.saip.backend.model.dto.SolicitudDTO;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.service.AutorizacionRecursosService;
import pe.gob.saip.backend.service.CiudadanoService;
import pe.gob.saip.backend.service.EntidadService;
import pe.gob.saip.backend.service.MotorNotificacionesService;
import pe.gob.saip.backend.service.SolicitudService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SolicitudRestControllerTest {

    @Mock
    SolicitudService solicitudService;

    @Mock
    CiudadanoService ciudadanoService;

    @Mock
    EntidadService entidadService;

    @Mock
    MotorNotificacionesService motorNotificacionesService;

    @Mock
    AutorizacionRecursosService autorizacionRecursosService;

    @InjectMocks
    SolicitudRestController solicitudRestController;

    private SolicitudDTO crearDto(Long id, String expediente) {
        return new SolicitudDTO(
                id, expediente, "Asunto", "Descripcion", "RECEPCIONADA",
                null, null, "2026-07-01T10:00:00", "2026-07-15", 10,
                9L, "Ciudadano Demo", "70000001", "ciudadano@test.pe", null,
                5L, "Entidad Demo", "ENT", true, false, false, false,
                "PUBLICA", true, null, null, null, null, null, null, null,
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of()
        );
    }

    @Test
    void listar_debeDelegarEnListarTodasAccesibles() {
        var dtos = List.of(crearDto(1L, "SAIP-2026-00001"));
        when(solicitudService.listarTodasAccesibles()).thenReturn(dtos);

        ResponseEntity<List<SolicitudDTO>> response = solicitudRestController.listar();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(solicitudService).listarTodasAccesibles();
    }

    @Test
    void listarPorCiudadano_debeDelegarEnListarPorCiudadano() {
        var dtos = List.of(crearDto(1L, "SAIP-2026-00001"));
        when(solicitudService.listarPorCiudadano(9L)).thenReturn(dtos);

        ResponseEntity<List<SolicitudDTO>> response = solicitudRestController.listarPorCiudadano(9L);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(solicitudService).listarPorCiudadano(9L);
    }

    @Test
    void listarPorEntidad_debeDelegarEnListarPorEntidad() {
        var dtos = List.of(crearDto(1L, "SAIP-2026-00001"));
        when(solicitudService.listarPorEntidad(5L)).thenReturn(dtos);

        ResponseEntity<List<SolicitudDTO>> response = solicitudRestController.listarPorEntidad(5L);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(solicitudService).listarPorEntidad(5L);
    }

    @Test
    void listarPorEstado_debeDelegarEnListarPorEstado() {
        var dtos = List.of(crearDto(1L, "SAIP-2026-00001"));
        when(solicitudService.listarPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA)).thenReturn(dtos);

        ResponseEntity<List<SolicitudDTO>> response = solicitudRestController.listarPorEstado("RECEPCIONADA");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(solicitudService).listarPorEstado(Solicitud.EstadoSolicitud.RECEPCIONADA);
    }
}
