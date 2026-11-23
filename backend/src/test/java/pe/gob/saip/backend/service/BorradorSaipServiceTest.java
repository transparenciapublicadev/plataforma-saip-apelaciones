package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.config.ClockConfig;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.GuardarBorradorSaipRequest;
import pe.gob.saip.backend.model.entity.BorradorSaip;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.repository.BorradorSaipRepository;
import pe.gob.saip.backend.repository.EntidadRepository;

@ExtendWith(MockitoExtension.class)
class BorradorSaipServiceTest {

    @Mock private BorradorSaipRepository borradores;
    @Mock private EntidadRepository entidades;
    @Mock private AutorizacionRecursosService autorizacion;

    private BorradorSaipService service;
    private Ciudadano ciudadano;

    @BeforeEach
    void setUp() {
        service = new BorradorSaipService(borradores, entidades, autorizacion,
                Clock.fixed(Instant.parse("2026-11-21T15:00:00Z"), ZoneOffset.UTC).withZone(ClockConfig.ZONA_LIMA));
        ciudadano = new Ciudadano();
        ciudadano.setIdUsuario(10L);
        when(autorizacion.ciudadanoDeLaSesion()).thenReturn(ciudadano);
    }

    @Test
    void guardarNuevoQuedaEnLaCuentaDeLaSesionSinExpediente() {
        when(borradores.countByCiudadano_IdUsuario(10L)).thenReturn(0L);
        when(borradores.save(any())).thenAnswer(invocation -> {
            BorradorSaip guardado = invocation.getArgument(0);
            guardado.setIdBorrador(4L);
            return guardado;
        });

        var dto = service.guardar(null, pedido(null, "Presupuesto"));

        assertThat(dto.id()).isEqualTo(4L);
        assertThat(dto.asunto()).isEqualTo("Presupuesto");
        assertThat(dto.entidadId()).isNull();
        verify(entidades, never()).findById(any());
    }

    @Test
    void noGuardaUnFormularioVacioNiSuperaVeinte() {
        assertThatThrownBy(() -> service.guardar(null, pedido(null, "  ")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(borradores, never()).save(any());

        when(borradores.countByCiudadano_IdUsuario(10L)).thenReturn(20L);
        assertThatThrownBy(() -> service.guardar(null, pedido(null, "Otro pedido")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(borradores, never()).save(any());
    }

    @Test
    void actualizarUnoAjenoRespondeComoSiNoExistiera() {
        when(borradores.findByIdBorradorAndCiudadano_IdUsuario(99L, 10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.guardar(99L, pedido(null, "Ajeno")))
                .isInstanceOf(RecursoNoEncontradoException.class);
        verify(borradores, never()).save(any());
    }

    @Test
    void asociaSoloUnaEntidadExistenteYNormalizaElCanal() {
        Entidad entidad = new Entidad();
        entidad.setIdEntidad(3L);
        entidad.setNombre("Entidad sintética");
        when(borradores.countByCiudadano_IdUsuario(10L)).thenReturn(1L);
        when(entidades.findById(3L)).thenReturn(Optional.of(entidad));
        when(borradores.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var dto = service.guardar(null, new GuardarBorradorSaipRequest(
                3L, "Asunto", "Descripción", "Tema", "Oficina",
                true, false, false, false, "correo", true, false, false, 2));

        assertThat(dto.entidadId()).isEqualTo(3L);
        assertThat(dto.canalNotificacion()).isEqualTo("CORREO");
        assertThat(dto.paso()).isEqualTo(2);
    }

    @Test
    void eliminarUsaLaCuentaDeLaSesion() {
        BorradorSaip propio = new BorradorSaip();
        propio.setIdBorrador(4L);
        when(borradores.findByIdBorradorAndCiudadano_IdUsuario(4L, 10L)).thenReturn(Optional.of(propio));

        service.eliminar(4L);

        verify(borradores).delete(propio);
    }

    private static GuardarBorradorSaipRequest pedido(Long entidadId, String asunto) {
        return new GuardarBorradorSaipRequest(entidadId, asunto, null, null, null,
                false, false, false, false, null, false, false, false, 1);
    }
}
