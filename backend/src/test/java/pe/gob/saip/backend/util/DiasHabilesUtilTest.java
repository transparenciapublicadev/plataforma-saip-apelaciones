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

    @Test
    void unaPresentacionDel11DeNoviembreDe2026VenceEl25YEl19QuedanCincoDias() {
        LocalDate presentacion = LocalDate.of(2026, 11, 11);
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(presentacion, 10);

        assertThat(limite).isEqualTo(LocalDate.of(2026, 11, 25));
        assertThat(DiasHabilesUtil.diasHabilesVigentes(presentacion, limite, LocalDate.of(2026, 11, 19))).isEqualTo(5);
    }

    @Test
    void semanaSantaYEl27DeJulioDe2026NoSonDiasHabiles() {
        assertThat(DiasHabilesUtil.esDiaHabil(LocalDate.of(2026, 4, 2))).isFalse();
        assertThat(DiasHabilesUtil.esDiaHabil(LocalDate.of(2026, 4, 3))).isFalse();
        assertThat(DiasHabilesUtil.esDiaHabil(LocalDate.of(2026, 1, 2))).isFalse();
        assertThat(DiasHabilesUtil.sumarDiasHabiles(LocalDate.of(2026, 7, 24), 3))
                .isEqualTo(LocalDate.of(2026, 8, 3));
    }
}
