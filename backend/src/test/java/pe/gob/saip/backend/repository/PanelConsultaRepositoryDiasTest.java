package pe.gob.saip.backend.repository;

import org.junit.jupiter.api.Test;
import pe.gob.saip.backend.repository.PanelConsultaRepository.PlazoAbierto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PanelConsultaRepositoryDiasTest {

    @Test
    void elDiaDeLaPresentacionCuentaDiezYElVencidoNoEntra() {
        LocalDate jueves = LocalDate.of(2026, 11, 12);
        Map<String, Long> dias = PanelConsultaRepository.contarDiasRestantes(List.of(
            new PlazoAbierto(jueves, LocalDate.of(2026, 11, 26), 1),
            new PlazoAbierto(jueves, jueves.minusDays(1), 1)), jueves);

        assertThat(dias).containsEntry("10", 1L);
        assertThat(dias).hasSize(1);
    }

    @Test
    void agrupaElMismoDiaHabilRestante() {
        LocalDate hoy = LocalDate.of(2026, 11, 13);
        LocalDate presentacion = LocalDate.of(2026, 11, 12);
        LocalDate limite = LocalDate.of(2026, 11, 26);

        assertThat(PanelConsultaRepository.contarDiasRestantes(List.of(
            new PlazoAbierto(presentacion, limite, 2),
            new PlazoAbierto(hoy, limite, 3)), hoy)).containsExactlyEntriesOf(Map.of("10", 2L, "9", 3L));
    }
}
