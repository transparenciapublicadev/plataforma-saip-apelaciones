package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.dto.ResolucionRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.time.LocalDateTime;

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

    @Mock
    TransicionesApelacionTtaipService transiciones;

    @Mock
    MotorNotificacionesService motorNotificacionesService;

    @InjectMocks
    TTAIPService ttaipService;

    @Test
    void declararEsteseALoResuelto_registraDecisionEspecialPendienteDeNotificacion() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        when(transiciones.bloquear(10L)).thenReturn(apelacion);
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
        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.NOTIFICACION_RESOLUCION_FINAL);
        assertThat(apelacion.isResuelta()).isFalse();
        assertThat(apelacion.getResultado()).isEqualTo("ESTESE_A_LO_RESUELTO");
        verify(expedienteTtaipService).registrarResolucion(resolucion);
    }

    @Test
    void declararNulidadDelActo_registraDecisionEspecialPendienteDeNotificacion() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        when(transiciones.bloquear(11L)).thenReturn(apelacion);
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
        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.NOTIFICACION_RESOLUCION_FINAL);
        assertThat(apelacion.isResuelta()).isFalse();
        assertThat(apelacion.getResultado()).isEqualTo("NULIDAD_DEL_ACTO");
        verify(expedienteTtaipService).registrarResolucion(resolucion);
    }

    @Test
    void declararEsteseALoResuelto_enEstadoCerrado_debeRechazarReglaNegocio() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);
        when(transiciones.bloquear(12L)).thenReturn(apelacion);

        assertThatThrownBy(() -> ttaipService.declararEsteseALoResuelto(12L, new ResolucionRequest(
                "Referencia a pronunciamiento previo.",
                null,
                null,
                null,
                null)))
                .isInstanceOf(pe.gob.saip.backend.exception.ConflictoEstadoException.class)
                .hasMessageContaining("ya está resuelta");

        verify(resolucionService, never()).save(any());
        verify(expedienteTtaipService, never()).registrarResolucion(any());
    }

    @Test
    void declararFundado_registraDecisionPendienteDeNotificacion() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        var entidad = new Entidad();
        entidad.setIdEntidad(3L);
        entidad.setNombre("Entidad de prueba");
        apelacion.setEntidadApelada(entidad);
        when(transiciones.bloquear(10L)).thenReturn(apelacion);
        when(expedienteTtaipService.prepararResolucion(any(Resolucion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(apelacionService.save(apelacion)).thenReturn(apelacion);

        ttaipService.declararFundado(10L, new ResolucionRequest(
                "Se fundan los extremos del pedido de información.",
                "Norma de transparencia y Ley 27806.",
                "Entregar información conforme a la resolución.",
                11L,
                true));

        ArgumentCaptor<Resolucion> resolucionCaptor = ArgumentCaptor.forClass(Resolucion.class);
        verify(resolucionService).save(resolucionCaptor.capture());
        Resolucion resolucion = resolucionCaptor.getValue();
        assertThat(resolucion.getDecision()).isEqualTo(Resolucion.DecisionResolucion.FUNDADO);
        assertThat(resolucion.getTipoResolucion()).isEqualTo(Resolucion.TipoResolucion.RESOLUCION_FINAL);
        assertThat(resolucion.getIniciarProcesoDisciplinario()).isTrue();
        assertThat(apelacion.getEstado()).isEqualTo(Apelacion.EstadoApelacion.NOTIFICACION_RESOLUCION_FINAL);
        assertThat(apelacion.isResuelta()).isFalse();
        assertThat(apelacion.getResultado()).isEqualTo("FUNDADO");
        verify(expedienteTtaipService).registrarResolucion(resolucion);
    }

    @Test
    void declararFundado_requiereIdentificarALaEntidadObligada() {
        Apelacion apelacion = crearApelacion(Apelacion.EstadoApelacion.EN_RESOLUCION);
        when(transiciones.bloquear(10L)).thenReturn(apelacion);

        assertThatThrownBy(() -> ttaipService.declararFundado(10L, new ResolucionRequest(
                "Se fundan los extremos del pedido de información.", null, null, null, false)))
                .isInstanceOf(pe.gob.saip.backend.exception.ConflictoEstadoException.class)
                .hasMessageContaining("entidad obligada");
        verify(resolucionService, never()).save(any());
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
