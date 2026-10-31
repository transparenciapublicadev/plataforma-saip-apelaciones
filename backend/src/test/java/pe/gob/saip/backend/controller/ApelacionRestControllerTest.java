package pe.gob.saip.backend.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.service.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApelacionRestControllerTest {

    @Mock
    ApelacionService apelacionService;

    @Mock
    SolicitudService solicitudService;

    @Mock
    CiudadanoService ciudadanoService;

    @Mock
    ExpedienteTtaipService expedienteTtaipService;

    @Mock
    ElevacionApelacionTtaipService elevacionService;

    @Mock
    AutorizacionRecursosService autorizacionRecursosService;

    @Mock
    SubsanacionTtaipService subsanacionTtaipService;

    @Mock
    TransicionesApelacionTtaipService transiciones;

    @InjectMocks
    ApelacionRestController apelacionRestController;

    private ApelacionDTO crearDto(Long id, String expediente) {
        return new ApelacionDTO(
                id, expediente, "Fundamentos de prueba", "PENDIENTE_ELEVACION", null,
                "2026-07-01T10:00:00", null, null, null, null,
                1L, "SAIP-2026-00001", "Asunto", 9L, "Ciudadano Demo",
                5L, "Entidad Demo", "INTERNA", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null,
                null, null, null, null, null,
                List.of(), List.of(), List.of(), false, null
        );
    }

    @Test
    void listar_debeDelegarEnListarTodasAccesibles() {
        var dtos = List.of(crearDto(1L, "00001-2026-JUS/TTAIP"));
        when(apelacionService.listarTodasAccesibles()).thenReturn(dtos);

        ResponseEntity<List<ApelacionDTO>> response = apelacionRestController.listar();

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(apelacionService).listarTodasAccesibles();
    }

    @Test
    void obtenerPorId_debeDelegarEnObtenerDetalle() {
        var dto = crearDto(1L, "00001-2026-JUS/TTAIP");
        when(apelacionService.obtenerDetalle(1L)).thenReturn(dto);

        ResponseEntity<ApelacionDTO> response = apelacionRestController.obtenerPorId(1L);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dto);
        verify(apelacionService).obtenerDetalle(1L);
    }

    @Test
    void obtenerPorExpedienteQuery_debeDelegarEnObtenerDetallePorExpediente() {
        var dto = crearDto(1L, "00001-2026-JUS/TTAIP");
        when(apelacionService.obtenerDetallePorExpediente("00001-2026-JUS/TTAIP")).thenReturn(dto);

        ResponseEntity<ApelacionDTO> response = apelacionRestController.obtenerPorExpedienteQuery("00001-2026-JUS/TTAIP");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dto);
        verify(apelacionService).obtenerDetallePorExpediente("00001-2026-JUS/TTAIP");
    }

    @Test
    void listarPorCiudadano_debeDelegarEnListarPorCiudadano() {
        var dtos = List.of(crearDto(1L, "00001-2026-JUS/TTAIP"));
        when(apelacionService.listarPorCiudadano(9L)).thenReturn(dtos);

        ResponseEntity<List<ApelacionDTO>> response = apelacionRestController.listarPorCiudadano(9L);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(apelacionService).listarPorCiudadano(9L);
    }

    @Test
    void listarPorEstado_debeDelegarEnListarPorEstado() {
        var dtos = List.of(crearDto(1L, "00001-2026-JUS/TTAIP"));
        when(apelacionService.listarPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION)).thenReturn(dtos);

        ResponseEntity<List<ApelacionDTO>> response = apelacionRestController.listarPorEstado("PENDIENTE_ELEVACION");

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(response.getBody()).isEqualTo(dtos);
        verify(apelacionService).listarPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
    }
}
