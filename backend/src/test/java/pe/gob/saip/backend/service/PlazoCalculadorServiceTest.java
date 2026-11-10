package pe.gob.saip.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import pe.gob.saip.backend.config.ClockConfig;
import pe.gob.saip.backend.model.dto.CalendarioAnioResumenDTO;
import pe.gob.saip.backend.model.entity.FeriadoCalendario;
import pe.gob.saip.backend.repository.FeriadoCalendarioRepository;

import java.time.*;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Suite de pruebas unitarias exhaustivas para PlazoCalculadorService,
 * verificando el reloj legal, feriados nacionales, Semana Santa y suspensiones.
 */
class PlazoCalculadorServiceTest {

    private PlazoCalculadorService plazoCalculadorService;
    private FeriadoCalendarioRepository feriadoRepository;

    private record TestCase(LocalDate fechaRegistro, int diasHabilesLimit, LocalDate expectedVencimiento) {}

    @BeforeEach
    void setUp() {
        feriadoRepository = mock(FeriadoCalendarioRepository.class);
        Clock fixedClock = Clock.fixed(
                Instant.parse("2026-07-01T12:00:00Z"),
                ClockConfig.ZONA_LIMA
        );
        this.plazoCalculadorService = new PlazoCalculadorServiceImpl(fixedClock, feriadoRepository);
    }

    @Test
    @DisplayName("Cálculo estándar de fechas de vencimiento sin cruce de feriados")
    void calcularFechaVencimiento_ShouldSucceedForStandardCases() {
        LocalDate miercoles = LocalDate.of(2026, 7, 1);

        List<TestCase> testCases = List.of(
                new TestCase(miercoles, 0, miercoles),
                new TestCase(miercoles, 1, LocalDate.of(2026, 7, 2)),
                new TestCase(miercoles, 2, LocalDate.of(2026, 7, 3)),
                new TestCase(miercoles, 3, LocalDate.of(2026, 7, 6)),
                new TestCase(miercoles, 5, LocalDate.of(2026, 7, 8)),
                new TestCase(miercoles, 10, LocalDate.of(2026, 7, 15))
        );

        for (TestCase tc : testCases) {
            LocalDate actual = plazoCalculadorService.calcularFechaVencimiento(tc.fechaRegistro(), tc.diasHabilesLimit());
            assertThat(actual)
                    .as("Cálculo falló para registro: %s y límite: %d", tc.fechaRegistro(), tc.diasHabilesLimit())
                    .isEqualTo(tc.expectedVencimiento());
        }
    }

    @Test
    @DisplayName("Cálculo de vencimiento cuando el registro se efectúa en fin de semana")
    void calcularFechaVencimiento_ShouldHandleWeekendRegistrations() {
        LocalDate sabado = LocalDate.of(2026, 7, 4);
        LocalDate domingo = LocalDate.of(2026, 7, 5);

        assertThat(plazoCalculadorService.calcularFechaVencimiento(sabado, 1))
                .isEqualTo(LocalDate.of(2026, 7, 6));

        assertThat(plazoCalculadorService.calcularFechaVencimiento(domingo, 1))
                .isEqualTo(LocalDate.of(2026, 7, 6));
    }

    @Test
    @DisplayName("Lanza excepción si la fecha es nula o el límite es negativo")
    void calcularFechaVencimiento_ShouldThrowExceptionOnInvalidArgs() {
        assertThatThrownBy(() -> plazoCalculadorService.calcularFechaVencimiento(null, 5))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nula");

        assertThatThrownBy(() -> plazoCalculadorService.calcularFechaVencimiento(LocalDate.now(), -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("negativo");
    }

    @Test
    @DisplayName("Cruce de Fiestas Patrias (28 y 29 de julio) y día no laborable (27 de julio)")
    void calcularFechaVencimiento_ShouldSkipFiestasPatriasAndNonWorkingDays() {
        // Viernes 24 de julio de 2026 + 3 días hábiles:
        // Sáb 25: fin de semana
        // Dom 26: fin de semana
        // Lun 27: día no laborable oficial
        // Mar 28: Fiestas Patrias (Feriado)
        // Mié 29: Fiestas Patrias (Feriado)
        // Jue 30: Día hábil 1
        // Vie 31: Día hábil 2
        // Sáb 1 ago, Dom 2 ago: fin de semana
        // Lun 3 ago: Día hábil 3 -> Vence Lun 03/08/2026
        LocalDate viernes24 = LocalDate.of(2026, 7, 24);
        LocalDate vencimiento = plazoCalculadorService.calcularFechaVencimiento(viernes24, 3);
        assertThat(vencimiento).isEqualTo(LocalDate.of(2026, 8, 3));
    }

    @Test
    @DisplayName("Reconocimiento dinámico de Semana Santa 2026 (Jueves y Viernes Santo)")
    void esDiaHabil_ShouldIdentifySemanaSantaHolidays() {
        // En 2026, Pascua es 5 de abril. Jueves Santo es 2 de abril y Viernes Santo es 3 de abril.
        LocalDate juevesSanto = LocalDate.of(2026, 4, 2);
        LocalDate viernesSanto = LocalDate.of(2026, 4, 3);
        LocalDate lunesSiguiente = LocalDate.of(2026, 4, 6);

        assertThat(plazoCalculadorService.esDiaHabil(juevesSanto)).isFalse();
        assertThat(plazoCalculadorService.esDiaHabil(viernesSanto)).isFalse();
        assertThat(plazoCalculadorService.motivoInhabil(juevesSanto, null)).isEqualTo("Jueves Santo");
        assertThat(plazoCalculadorService.motivoInhabil(viernesSanto, null)).isEqualTo("Viernes Santo");
        assertThat(plazoCalculadorService.esDiaHabil(lunesSiguiente)).isTrue();
    }

    @Test
    @DisplayName("Suspensión local de plazos solo para la entidad afectada")
    void esDiaHabil_ShouldHandleEntitySpecificSuspension() {
        LocalDate fechaSuspension = LocalDate.of(2026, 5, 14); // Jueves 14 de mayo

        FeriadoCalendario suspension = new FeriadoCalendario();
        suspension.setId("susp-paro-101");
        suspension.setNombre("Paro local y emergencia administrativa");
        suspension.setTipo("suspension");
        suspension.setActivo(true);
        suspension.setAlcanceNacional(false);
        suspension.setFecha(fechaSuspension);
        suspension.setHasta(fechaSuspension);
        suspension.setEntidadesIds("[{\"id\":\"101\",\"nombre\":\"Muni Central\"}]");

        when(feriadoRepository.findByActivoTrue()).thenReturn(List.of(suspension));

        // Entidad 101 tiene suspensión
        assertThat(plazoCalculadorService.esDiaHabil(fechaSuspension, 101L)).isFalse();
        assertThat(plazoCalculadorService.motivoInhabil(fechaSuspension, 101L))
                .isEqualTo("Paro local y emergencia administrativa");

        // Entidad 102 NO tiene suspensión
        assertThat(plazoCalculadorService.esDiaHabil(fechaSuspension, 102L)).isTrue();
    }

    @Test
    @DisplayName("Recepción efectiva de escrito presentado en día inhábil")
    void recepcionEfectiva_ShouldAdvanceToNextBusinessDay() {
        // Presentado en domingo 5 de julio de 2026
        LocalDate domingo = LocalDate.of(2026, 7, 5);
        LocalDate efectiva = plazoCalculadorService.recepcionEfectiva(domingo, null);
        assertThat(efectiva).isEqualTo(LocalDate.of(2026, 7, 6));

        // Presentado en lunes hábil
        LocalDate lunes = LocalDate.of(2026, 7, 6);
        assertThat(plazoCalculadorService.recepcionEfectiva(lunes, null)).isEqualTo(lunes);
    }

    @Test
    @DisplayName("Conteo de días hábiles transcurridos y restantes")
    void contarDiasHabiles_ShouldCountCorrectly() {
        LocalDate inicio = LocalDate.of(2026, 7, 1); // Mié
        LocalDate fin = LocalDate.of(2026, 7, 6);    // Lun siguiente
        // Días hábiles en (1, 6]: Jue 2 (1), Vie 3 (2), Lun 6 (3)
        assertThat(plazoCalculadorService.contarDiasHabiles(inicio, fin)).isEqualTo(3);
    }

    @Test
    @DisplayName("Determinismo temporal con Clock inyectado y verificación de exceso de plazo")
    void verificarExcesoDePlazo_ShouldDetermineStatusWithInjectedClock() {
        // Clock congelado en 2026-07-01
        assertThat(plazoCalculadorService.hoy()).isEqualTo(LocalDate.of(2026, 7, 1));

        // Registro de hace 15 días hábiles con plazo 10 -> vencido
        LocalDate registroAntiguo = LocalDate.of(2026, 6, 1);
        assertThat(plazoCalculadorService.verificarExcesoDePlazo(registroAntiguo, 10)).isTrue();

        // Registro reciente (2026-06-30) con plazo 10 -> no vencido
        LocalDate registroReciente = LocalDate.of(2026, 6, 30);
        assertThat(plazoCalculadorService.verificarExcesoDePlazo(registroReciente, 10)).isFalse();
    }

    @Test
    @DisplayName("Resumen anual computa métricas oficiales")
    void obtenerResumenAnio_ShouldComputeOfficialMetrics() {
        CalendarioAnioResumenDTO resumen = plazoCalculadorService.obtenerResumenAnio(2026);
        assertThat(resumen.anio()).isEqualTo(2026);
        assertThat(resumen.diasHabilesTotal()).isGreaterThan(240);
        assertThat(resumen.feriadosLaborables()).isGreaterThan(10);
        assertThat(resumen.inhabiles()).isNotEmpty();
    }
}
