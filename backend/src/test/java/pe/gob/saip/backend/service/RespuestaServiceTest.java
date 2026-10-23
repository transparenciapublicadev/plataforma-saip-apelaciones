package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.CrearRespuestaRequest;
import pe.gob.saip.backend.model.dto.RespuestaDTO;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.RespuestaRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RespuestaServiceTest {

    @Mock
    RespuestaRepository respuestaRepository;

    @Mock
    SolicitudService solicitudService;

    @Mock
    FuncionarioService funcionarioService;

    @Mock AutorizacionRecursosService autorizacion;

    @InjectMocks
    RespuestaService respuestaService;

    private Solicitud crearSolicitudSinRespuesta() {
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(1L);
        solicitud.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        return solicitud;
    }

    private Funcionario crearFuncionario() {
        Funcionario funcionario = new Funcionario();
        funcionario.setIdUsuario(10L);
        funcionario.setNombreCompleto("Funcionario Test");
        return funcionario;
    }

    @Test
    void crearRespuesta_conSilencioAdministrativo_manual_debeFallar() {
        Solicitud solicitud = crearSolicitudSinRespuesta();
        when(solicitudService.bloquearSolicitudInstitucional(1L)).thenReturn(solicitud);
        when(funcionarioService.obtenerFuncionarioPorId(10L)).thenReturn(Optional.of(crearFuncionario()));

        CrearRespuestaRequest request = new CrearRespuestaRequest(
                1L,
                10L,
                "SILENCIO_ADMINISTRATIVO",
                "No corresponde registrar manualmente",
                null,
                null,
                null,
                null
        );

        assertThatThrownBy(() -> respuestaService.crearRespuesta(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Silencio administrativo se aplica automaticamente");

        verify(respuestaRepository, never()).save(any(Respuesta.class));
    }

    @Test
    void crearRespuesta_conEntregaTotal_debePersistirYActualizarEstado() {
        Solicitud solicitud = crearSolicitudSinRespuesta();
        Funcionario funcionario = crearFuncionario();

        when(solicitudService.bloquearSolicitudInstitucional(1L)).thenReturn(solicitud);
        when(funcionarioService.obtenerFuncionarioPorId(10L)).thenReturn(Optional.of(funcionario));
        when(respuestaRepository.save(any(Respuesta.class))).thenAnswer(inv -> inv.getArgument(0));
        when(solicitudService.save(any(Solicitud.class))).thenAnswer(inv -> inv.getArgument(0));

        CrearRespuestaRequest request = new CrearRespuestaRequest(
                1L,
                10L,
                "ENTREGA_TOTAL",
                "Se entrega la informacion solicitada",
                null,
                null,
                "DIGITAL",
                2
        );

        RespuestaDTO resultado = respuestaService.crearRespuesta(request);

        assertThat(resultado).isNotNull();
        assertThat(resultado.tipoRespuesta()).isEqualTo("ENTREGA_TOTAL");
        assertThat(solicitud.getEstado()).isEqualTo(Solicitud.EstadoSolicitud.RESPONDIDA);
        verify(respuestaRepository).save(any(Respuesta.class));
        verify(solicitudService).save(solicitud);
    }
}
