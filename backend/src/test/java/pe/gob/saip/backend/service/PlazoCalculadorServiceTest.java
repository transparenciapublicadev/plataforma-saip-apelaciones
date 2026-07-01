package pe.gob.saip.backend.service;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Suite de pruebas unitarias robustas para PlazoCalculadorService.
 */
class PlazoCalculadorServiceTest {

    private PlazoCalculadorService plazoCalculadorService;

    // Estructura de datos inmutable utilizando Java Record para definir casos de prueba
    private record TestCase(LocalDate fechaRegistro, int diasHabilesLimit, LocalDate expectedVencimiento) {}

    @BeforeEach
    void setUp() {
        this.plazoCalculadorService = new PlazoCalculadorServiceImpl();
    }

    @Test
    void calcularFechaVencimiento_ShouldSucceedForStandardCases() {
        // Miércoles 1 de julio de 2026
        LocalDate miercoles = LocalDate.of(2026, 7, 1);

        List<TestCase> testCases = List.of(
            // Mismo día (límite 0)
            new TestCase(miercoles, 0, miercoles),
            
            // Siguiente día de la semana (límite 1) -> Jueves 2
            new TestCase(miercoles, 1, LocalDate.of(2026, 7, 2)),
            
            // Dos días (límite 2) -> Viernes 3
            new TestCase(miercoles, 2, LocalDate.of(2026, 7, 3)),
            
            // Cruzando un fin de semana (límite 3) -> Lunes 6 (se saltan Viernes 3 -> Lunes 6, porque Viernes es 1, Lunes es 2, etc.)
            // Espera, Miercoles + 3 días hábiles: Jueves (1), Viernes (2), Lunes (3). Sí!
            new TestCase(miercoles, 3, LocalDate.of(2026, 7, 6)),
            
            // Cruzando un fin de semana completo (límite 5) -> Jueves (1), Viernes (2), Lunes (3), Martes (4), Miércoles (5) -> Miércoles 8
            new TestCase(miercoles, 5, LocalDate.of(2026, 7, 8)),
            
            // Cruzando dos fines de semana enteros (límite 10) -> Miércoles 15
            // Cálculo:
            // Jue 2 (1), Vie 3 (2)
            // Lun 6 (3), Mar 7 (4), Mie 8 (5), Jue 9 (6), Vie 10 (7)
            // Lun 13 (8), Mar 14 (9), Mie 15 (10)
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
    void calcularFechaVencimiento_ShouldHandleWeekendRegistrations() {
        // Sábado 4 de julio de 2026
        LocalDate sabado = LocalDate.of(2026, 7, 4);
        // Domingo 5 de julio de 2026
        LocalDate domingo = LocalDate.of(2026, 7, 5);

        // Si se registra en fin de semana, el conteo del primer día hábil debe ser Lunes (1) -> Lunes 6
        assertThat(plazoCalculadorService.calcularFechaVencimiento(sabado, 1))
            .isEqualTo(LocalDate.of(2026, 7, 6));

        assertThat(plazoCalculadorService.calcularFechaVencimiento(domingo, 1))
            .isEqualTo(LocalDate.of(2026, 7, 6));
    }

    @Test
    void calcularFechaVencimiento_ShouldThrowExceptionOnInvalidArgs() {
        assertThatThrownBy(() -> plazoCalculadorService.calcularFechaVencimiento(null, 5))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("nula");

        assertThatThrownBy(() -> plazoCalculadorService.calcularFechaVencimiento(LocalDate.now(), -1))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("negativo");
    }

    @Test
    void verificarExcesoDePlazo_ShouldDetermineCorrectStatus() {
        // Una fecha de registro muy antigua (hace 20 días hábiles) con plazo 10 debe dar verdadero (plazo excedido)
        LocalDate registroAntiguo = LocalDate.now().minusDays(30);
        assertThat(plazoCalculadorService.verificarExcesoDePlazo(registroAntiguo, 10))
            .isTrue();

        // Una fecha de registro futura o actual con plazo largo (ej. 10 días hábiles) no debe dar exceso de plazo
        LocalDate hoy = LocalDate.now();
        assertThat(plazoCalculadorService.verificarExcesoDePlazo(hoy, 10))
            .isFalse();
    }
}
