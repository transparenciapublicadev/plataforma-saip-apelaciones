package pe.gob.saip.backend.util;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.Set;

/**
 * Utilidad para cálculo de días hábiles según legislación peruana.
 * Replica la lógica de core/domain/util/DiasHabilesUtil.kt para el backend Java.
 *
 * Excluye sábados, domingos y feriados nacionales del Perú.
 */
public final class DiasHabilesUtil {

    private DiasHabilesUtil() {}

    // Feriados fijos del Perú (mes-día)
    private static final Set<MonthDay> FERIADOS_FIJOS = Set.of(
        MonthDay.of(1, 1),   // Año Nuevo
        MonthDay.of(5, 1),   // Día del Trabajo
        MonthDay.of(6, 7),   // Batalla de Arica
        MonthDay.of(6, 29),  // San Pedro y San Pablo
        MonthDay.of(7, 23),  // Día de la Fuerza Aérea
        MonthDay.of(7, 28),  // Fiestas Patrias
        MonthDay.of(7, 29),  // Fiestas Patrias
        MonthDay.of(8, 6),   // Batalla de Junín
        MonthDay.of(8, 30),  // Santa Rosa de Lima
        MonthDay.of(10, 8),  // Combate de Angamos
        MonthDay.of(11, 1),  // Día de Todos los Santos
        MonthDay.of(12, 8),  // Inmaculada Concepción
        MonthDay.of(12, 9),  // Batalla de Ayacucho
        MonthDay.of(12, 25)  // Navidad
    );

    /**
     * Verifica si una fecha es día hábil (no sábado, no domingo, no feriado).
     */
    public static boolean esDiaHabil(LocalDate fecha) {
        DayOfWeek dia = fecha.getDayOfWeek();
        if (dia == DayOfWeek.SATURDAY || dia == DayOfWeek.SUNDAY) {
            return false;
        }
        return !esFeriado(fecha);
    }

    /**
     * Verifica si una fecha es feriado nacional peruano.
     */
    public static boolean esFeriado(LocalDate fecha) {
        return FERIADOS_FIJOS.contains(MonthDay.from(fecha));
    }

    /**
     * Calcula la fecha límite sumando días hábiles a partir de una fecha.
     *
     * @param fechaInicio Fecha de inicio (no se cuenta)
     * @param diasHabiles Cantidad de días hábiles a sumar
     * @return Fecha resultante tras sumar los días hábiles
     */
    public static LocalDate sumarDiasHabiles(LocalDate fechaInicio, int diasHabiles) {
        LocalDate fecha = fechaInicio;
        int contador = 0;
        while (contador < diasHabiles) {
            fecha = fecha.plusDays(1);
            if (esDiaHabil(fecha)) {
                contador++;
            }
        }
        return fecha;
    }

    /**
     * Cuenta los días hábiles entre dos fechas (ambas excluidas si no son hábiles).
     *
     * @param desde Fecha de inicio (inclusive si es hábil)
     * @param hasta Fecha final (inclusive si es hábil)
     * @return Número de días hábiles transcurridos
     */
    public static int contarDiasHabiles(LocalDate desde, LocalDate hasta) {
        if (desde.isAfter(hasta)) {
            return -contarDiasHabiles(hasta, desde);
        }
        int contador = 0;
        LocalDate fecha = desde;
        while (!fecha.isAfter(hasta)) {
            if (esDiaHabil(fecha)) {
                contador++;
            }
            fecha = fecha.plusDays(1);
        }
        return contador;
    }

    /**
     * Calcula los días hábiles restantes desde hoy hasta una fecha límite.
     *
     * @param fechaLimite Fecha límite
     * @return Días hábiles restantes (negativo si ya venció)
     */
    public static int diasHabilesRestantes(LocalDate fechaLimite) {
        return diasHabilesVigentes(null, fechaLimite, LocalDate.now());
    }

    /**
     * Días hábiles del plazo que siguen vigentes.
     * El plazo empieza el día siguiente a {@code ancla} y vence en {@code fechaLimite}, inclusive.
     * El día del ancla no se cuenta. Si hoy ya pertenece al plazo, hoy sí cuenta.
     */
    public static int diasHabilesVigentes(LocalDate ancla, LocalDate fechaLimite) {
        return diasHabilesVigentes(ancla, fechaLimite, LocalDate.now());
    }

    public static int diasHabilesVigentes(LocalDate ancla, LocalDate fechaLimite, LocalDate hoy) {
        if (fechaLimite == null || hoy == null) {
            return 0;
        }
        if (hoy.isAfter(fechaLimite)) {
            return -contarDiasHabiles(fechaLimite, hoy);
        }
        LocalDate desde = ancla != null && !hoy.isAfter(ancla) ? ancla.plusDays(1) : hoy;
        if (desde.isAfter(fechaLimite)) {
            return 0;
        }
        return contarDiasHabiles(desde, fechaLimite);
    }
}
