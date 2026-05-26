package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.ResolucionRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TTAIPServiceTest {

    @Mock
    ApelacionService apelacionService;

    @Mock
    ResolucionService resolucionService;

    @Mock
    MiembroTTAIPService miembroTTAIPService;

    @Mock
    ExpedienteTtaipService expedienteTtaipService;

    @InjectMocks
    TTAIPService ttaipService;

    @Test
    void declararEsteseALoResuelto_enResolucion_debeCerrarConDecisionEspecial() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        when(apelacionService.findById(10L)).thenReturn(Optional.of(apelacion));
        when(expedienteTtaipService.prepararResolucion(any(Resolucion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(apelacionService.save(apelacion)).thenReturn(apelacion);

        ttaipService.declararEsteseALoResuelto(10L, new ResolucionRequest(
                "Existe pronunciamiento previo aplicable al mismo pedido.",
                "TUO de la Ley 27444 y precedente administrativo aplicable.",
                "Referencia: Resolución previa 001-2026-JUS/TTAIP.",
                11L,
                null));

        ArgumentCaptor<Resolucion> resolucionCaptor = ArgumentCaptor.forClass(Resolucion.class);
        verify(resolucionService).save(resolucionCaptor.capture());
        Resolucion resolucion = resolucionCaptor.getValue();
        assertThat(resolucion.getDecision()).isEqualTo(Resolucion.DecisionResolucion.ESTESE_A_LO_RESUELTO);
        assertThat(resolucion.getTipoResolucion()).isEqualTo(Resolucion.TipoResolucion.RESOLUCION_FINAL);
        assertThat(resolucion.getFundamentoLegal()).contains("27444");
        assertThat(resolucion.getObservaciones()).contains("Resolución previa");
        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO);
        assertThat(apelacion.getResultado()).isEqualTo("ESTESE_A_LO_RESUELTO");
        verify(expedienteTtaipService).registrarResolucion(resolucion);
    }

    @Test
    void declararNulidadDelActo_enResolucion_debeCerrarConDecisionEspecial() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        when(apelacionService.findById(11L)).thenReturn(Optional.of(apelacion));
        when(expedienteTtaipService.prepararResolucion(any(Resolucion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(apelacionService.save(apelacion)).thenReturn(apelacion);

        ttaipService.declararNulidadDelActo(11L, new ResolucionRequest(
                "Se advierte vicio grave en la motivación de la respuesta de la entidad.",
                "Ley 27444, causal de nulidad del acto administrativo.",
                "Orden: retrotraer el procedimiento y emitir nuevo pronunciamiento.",
                null,
                null));

        ArgumentCaptor<Resolucion> resolucionCaptor = ArgumentCaptor.forClass(Resolucion.class);
        verify(resolucionService).save(resolucionCaptor.capture());
        Resolucion resolucion = resolucionCaptor.getValue();
        assertThat(resolucion.getDecision()).isEqualTo(Resolucion.DecisionResolucion.NULIDAD_DEL_ACTO);
        assertThat(resolucion.getObservaciones()).contains("retrotraer");
        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.RESUELTO_NULIDAD_ACTO);
        assertThat(apelacion.getResultado()).isEqualTo("NULIDAD_DEL_ACTO");
        verify(expedienteTtaipService).registrarResolucion(resolucion);
    }

    @Test
    void declararEsteseALoResuelto_enEstadoCerrado_debeRechazarReglaNegocio() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);
        when(apelacionService.findById(12L)).thenReturn(Optional.of(apelacion));

        assertThatThrownBy(() -> ttaipService.declararEsteseALoResuelto(12L, new ResolucionRequest(
                "Referencia a pronunciamiento previo.",
                null,
                null,
                null,
                null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ya está resuelta");

        verify(resolucionService, never()).save(any());
        verify(expedienteTtaipService, never()).registrarResolucion(any());
    }

    private Apelacion crearApelacion(Apelacion.EstadoApelacion estado) {
        Apelacion apelacion = new Apelacion();
        apelacion.setIdApelacion(10L);
        apelacion.setExpediente("00010-2026-JUS/TTAIP");
        apelacion.setFundamentos("Fundamentos de apelación");
        apelacion.setEstado(estado);
        apelacion.setFechaApelacion(LocalDateTime.of(2026, 5, 1, 10, 0));
        return apelacion;
    }
}
