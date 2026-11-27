package pe.gob.saip.backend.util;

import org.junit.jupiter.api.Test;

import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud.EstadoEntregaParcial;
import pe.gob.saip.backend.model.entity.Solicitud;

import java.time.LocalDate;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PlazoApelacionAmpliacionTest {

    private static final LocalDate ORDINARIO = LocalDate.of(2026, 11, 18);

    @Test
    void elCronogramaNoSeApelaElDiaDelVencimientoOrdinario() {
        assertThat(PlazoApelacionAmpliacion.permite(saip(ORDINARIO), ORDINARIO)).isFalse();
    }

    @Test
    void elCronogramaSeApelaDesdeElDiaHabilSiguienteDuranteQuinceDias() {
        LocalDate dia11 = LocalDate.of(2026, 11, 19);
        LocalDate ultimo = DiasHabilesUtil.sumarDiasHabiles(ORDINARIO, 15);

        assertThat(PlazoApelacionAmpliacion.permite(saip(ORDINARIO), dia11)).isTrue();
        assertThat(PlazoApelacionAmpliacion.permite(saip(ORDINARIO), ultimo)).isTrue();
        assertThat(PlazoApelacionAmpliacion.permite(saip(ORDINARIO), ultimo.plusDays(1))).isFalse();
    }

    @Test
    void unaEntregaRecibidaAbreOtrosQuinceDiasHabiles() {
        LocalDate entrega = LocalDate.of(2026, 12, 15);
        Solicitud solicitud = saip(LocalDate.of(2026, 1, 5));
        agregarEntrega(solicitud, entrega);

        assertThat(PlazoApelacionAmpliacion.permite(solicitud, entrega)).isTrue();
        assertThat(PlazoApelacionAmpliacion.permite(solicitud, DiasHabilesUtil.sumarDiasHabiles(entrega, 15))).isTrue();
        assertThat(PlazoApelacionAmpliacion.permite(solicitud,
            DiasHabilesUtil.sumarDiasHabiles(entrega, 15).plusDays(1))).isFalse();
    }

    @Test
    void elIncumplimientoYElSilencioDelPlazoAmpliadoSiguenApelables() {
        Solicitud incumplida = saip(LocalDate.of(2026, 1, 5));
        CronogramaEntregaParcialSolicitud hito = new CronogramaEntregaParcialSolicitud();
        hito.setEstado(EstadoEntregaParcial.PROGRAMADA);
        hito.setFechaProgramada(LocalDate.of(2026, 10, 1));
        hito.setAmpliacion(incumplida.getAmpliacionesPlazo().getFirst());
        incumplida.getAmpliacionesPlazo().getFirst().getCronograma().add(hito);

        assertThat(PlazoApelacionAmpliacion.permite(incumplida, LocalDate.of(2026, 11, 19))).isTrue();

        Solicitud silencio = saip(LocalDate.of(2026, 1, 5));
        silencio.setFechaLimite(LocalDate.of(2026, 11, 1));
        assertThat(PlazoApelacionAmpliacion.permite(silencio, LocalDate.of(2026, 11, 19))).isTrue();
    }

    @Test
    void sinAmpliacionNoCierraLasDemasApelaciones() {
        Solicitud solicitud = new Solicitud();
        solicitud.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        assertThat(PlazoApelacionAmpliacion.permite(solicitud, LocalDate.of(2026, 11, 19))).isTrue();
    }

    @Test
    void rechazaElRegistroFueraDePlazo() {
        assertThatThrownBy(() -> PlazoApelacionAmpliacion.validar(saip(ORDINARIO), ORDINARIO))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("15 días hábiles");
    }

    private static Solicitud saip(LocalDate ordinario) {
        Solicitud solicitud = new Solicitud();
        solicitud.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        solicitud.setFechaLimite(LocalDate.of(2027, 2, 17));
        AmpliacionPlazoSolicitud ampliacion = new AmpliacionPlazoSolicitud();
        ampliacion.setIdAmpliacion(4L);
        ampliacion.setEstadoAmpliacion(AmpliacionPlazoSolicitud.EstadoAmpliacion.NOTIFICADA);
        ampliacion.setFechaLimiteOriginal(ordinario);
        ampliacion.setFechaLimiteAmpliada(LocalDate.of(2027, 2, 17));
        ampliacion.setCronograma(new ArrayList<>());
        ampliacion.setSolicitud(solicitud);
        solicitud.setAmpliacionesPlazo(new ArrayList<>(java.util.List.of(ampliacion)));
        return solicitud;
    }

    private static void agregarEntrega(Solicitud solicitud, LocalDate fecha) {
        AmpliacionPlazoSolicitud ampliacion = solicitud.getAmpliacionesPlazo().getFirst();
        CronogramaEntregaParcialSolicitud hito = new CronogramaEntregaParcialSolicitud();
        hito.setEstado(EstadoEntregaParcial.ENTREGADA);
        hito.setFechaProgramada(fecha);
        hito.setFechaEntregaReal(fecha);
        hito.setAmpliacion(ampliacion);
        ampliacion.getCronograma().add(hito);
    }
}
