package pe.gob.saip.backend.util;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class DiasHabilesUtilTest {

    private static final LocalDate JUEVES = LocalDate.of(2026, 11, 12);

    @Test
    void elDiaDeLaRecepcionNoCuentaYQuedanDiezDiasHabiles() {
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(JUEVES, 10);

        assertThat(limite).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(DiasHabilesUtil.diasHabilesVigentes(JUEVES, limite, JUEVES)).isEqualTo(10);
    }

    @Test
    void elPrimerDiaHabilDelPlazoSigueContandoEseDia() {
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(JUEVES, 10);

        assertThat(DiasHabilesUtil.diasHabilesVigentes(JUEVES, limite, LocalDate.of(2026, 11, 13))).isEqualTo(10);
    }

    @Test
    void unFinDeSemanaNoConsumeElPlazo() {
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(JUEVES, 10);

        assertThat(DiasHabilesUtil.diasHabilesVigentes(JUEVES, limite, LocalDate.of(2026, 11, 14))).isEqualTo(9);
    }

    @Test
    void elDiaDelVencimientoQuedaUnDiaHabil() {
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(JUEVES, 10);

        assertThat(DiasHabilesUtil.diasHabilesVigentes(JUEVES, limite, limite)).isEqualTo(1);
    }
}
