package pe.gob.saip.backend.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/** Counts stored SAIP deadlines. The clock starts the day after presentation and ends on the response date, or today when there is no response. */
public final class PlazoAtencionReporte {
    private PlazoAtencionReporte() { }
    public record Muestra(LocalDate presentacion, LocalDate limite, LocalDate respuesta) { }
    public record Resultado(long enPlazoLegal, Double tiempoPromedioDiasHabiles) { }

    public static Resultado calcular(List<Muestra> filas, LocalDate hoy) {
        long enPlazo = 0;
        long muestras = 0;
        long suma = 0;
        for (Muestra fila : filas) {
            if (fila.respuesta() != null && fila.limite() != null && !fila.respuesta().isAfter(fila.limite())) enPlazo++;
            LocalDate fin = fila.respuesta() != null ? fila.respuesta() : hoy;
            if (fila.presentacion() != null && fin != null) {
                muestras++;
                suma += diasAtencion(fila.presentacion(), fin);
            }
        }
        Double promedio = muestras == 0 ? null : BigDecimal.valueOf(suma).divide(BigDecimal.valueOf(muestras), 1, RoundingMode.HALF_UP).doubleValue();
        return new Resultado(enPlazo, promedio);
    }

    static int diasAtencion(LocalDate presentacion, LocalDate respuesta) {
        LocalDate inicio = presentacion.plusDays(1);
        return respuesta.isBefore(inicio) ? 0 : DiasHabilesUtil.contarDiasHabiles(inicio, respuesta);
    }
}
