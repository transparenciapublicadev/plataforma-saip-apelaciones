package pe.gob.saip.backend.model.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ApelacionTest {

    private Apelacion crearApelacion(Apelacion.EstadoApelacion estado) {
        Apelacion a = new Apelacion();
        a.setIdApelacion(1L);
        a.setExpediente("00001-2025-JUS/TTAIP");
        a.setFundamentos("Fundamentos de prueba");
        a.setEstado(estado);
        a.setFechaApelacion(LocalDateTime.now());
        return a;
    }

    @Test
    void getId_debeRetornarIdApelacion() {
        Apelacion a = crearApelacion(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
    }

    @ParameterizedTest
    @EnumSource(value = Apelacion.EstadoApelacion.class,
            names = {"RESUELTO", "RESUELTO_FUNDADO", "RESUELTO_FUNDADO_EN_PARTE", "RESUELTO_INFUNDADO",
                     "RESUELTO_INFUNDADO_EN_PARTE", "RESUELTO_IMPROCEDENTE",
                     "TENER_POR_NO_PRESENTADO", "CONCLUSION_SUSTRACCION_MATERIA", "CONCLUSION_DESISTIMIENTO"})
    void isResuelta_estadosResueltos_debeRetornarTrue(Apelacion.EstadoApelacion estado) {
        Apelacion a = crearApelacion(estado);
        assertThat(a.isResuelta()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = Apelacion.EstadoApelacion.class,
            names = {"PENDIENTE_ELEVACION", "EN_CALIFICACION_1", "EN_SUBSANACION", "EN_CALIFICACION_2",
                     "NOTIFICACION_SEGUNDA_CALIFICACION", "EN_RESOLUCION"})
    void isResuelta_estadosNoResueltos_debeRetornarFalse(Apelacion.EstadoApelacion estado) {
        Apelacion a = crearApelacion(estado);
        assertThat(a.isResuelta()).isFalse();
    }

    @Test
    void getResolucion_sinResoluciones_debeRetornarNull() {
        Apelacion a = crearApelacion(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        assertThat(a.getResolucion()).isNull();
    }

    @Test
    void getResolucionPrimeraCalificacion_sinResoluciones_debeRetornarNull() {
        Apelacion a = crearApelacion(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION);
        assertThat(a.getResolucionPrimeraCalificacion()).isNull();
    }
}
