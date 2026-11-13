package pe.gob.saip.backend.util;

import org.junit.jupiter.api.Test;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.Resumen;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PlazoAtencionReporteTest {
    private static final LocalDate JUEVES = LocalDate.of(2026, 11, 12);
    private static final LocalDate LIMITE = LocalDate.of(2026, 11, 26);

    @Test
    void laRespuestaEnElDecimoDiaHabilCuentaDentroDelLimiteRegistrado() {
        var resultado = PlazoAtencionReporte.calcular(List.of(new PlazoAtencionReporte.Muestra(JUEVES, LIMITE, LIMITE)), JUEVES);

        assertThat(resultado.enPlazoLegal()).isEqualTo(1);
        assertThat(resultado.tiempoPromedioDiasHabiles()).isEqualTo(10.0);
    }

    @Test
    void unaRespuestaTardiaEntraAlPromedioYNoAlConteoEnPlazo() {
        var resultado = PlazoAtencionReporte.calcular(List.of(
            new PlazoAtencionReporte.Muestra(JUEVES, LIMITE, LIMITE.plusDays(1)),
            new PlazoAtencionReporte.Muestra(JUEVES, LIMITE, null)), JUEVES);

        assertThat(resultado.enPlazoLegal()).isZero();
        assertThat(resultado.tiempoPromedioDiasHabiles()).isEqualTo(5.5);
    }

    @Test
    void sinRespuestasElPromedioCuentaLosDiasHabilesHastaHoy() {
        var resultado = PlazoAtencionReporte.calcular(List.of(
            new PlazoAtencionReporte.Muestra(JUEVES, LIMITE, null),
            new PlazoAtencionReporte.Muestra(JUEVES, LIMITE, null)), LocalDate.of(2026, 11, 13));

        assertThat(resultado.enPlazoLegal()).isZero();
        assertThat(resultado.tiempoPromedioDiasHabiles()).isEqualTo(1.0);
    }

    @Test
    void responderElMismoDiaDeLaPresentacionCuentaCeroDias() {
        assertThat(PlazoAtencionReporte.diasAtencion(JUEVES, JUEVES)).isZero();
    }

    @Test
    void unResumenGuardadoSinPlazosSigueLeyendose() {
        String antiguo = """
            {"modo":"entidad","ambito":"entidad:1","entidadId":1,"entidad":"Entidad","desde":"2026-01-01","hasta":"2026-01-31","consultado":"2026-11-12T10:00:00","total":2,"conActuacion":0,"estados":[],"porMes":[],"resultados":[],"alcance":"Periodo consultado"}
            """;

        Resumen resumen = JsonMapper.builder().build().readValue(antiguo, Resumen.class);

        assertThat(resumen.total()).isEqualTo(2);
        assertThat(resumen.enPlazoLegal()).isNull();
        assertThat(resumen.tiempoPromedioDiasHabiles()).isNull();
    }
}
