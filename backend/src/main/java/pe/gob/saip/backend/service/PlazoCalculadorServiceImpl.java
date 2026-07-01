package pe.gob.saip.backend.service;

import java.time.DayOfWeek;
import java.time.LocalDate;

import org.springframework.stereotype.Service;

/**
 * Implementación declarativa del motor de cálculo de plazos legales.
 */
@Service
public class PlazoCalculadorServiceImpl implements PlazoCalculadorService {

    @Override
    public LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit) {
        if (fechaRegistro == null) {
            throw new IllegalArgumentException("La fecha de registro no puede ser nula");
        }
        if (diasHabilesLimit < 0) {
            throw new IllegalArgumentException("El límite de días hábiles no puede ser negativo");
        }

        LocalDate fechaVencimiento = fechaRegistro;
        int diasContados = 0;

        while (diasContados < diasHabilesLimit) {
            fechaVencimiento = fechaVencimiento.plusDays(1);
            DayOfWeek dayOfWeek = fechaVencimiento.getDayOfWeek();
            if (dayOfWeek != DayOfWeek.SATURDAY && dayOfWeek != DayOfWeek.SUNDAY) {
                diasContados++;
            }
        }

        return fechaVencimiento;
    }

    @Override
    public boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit) {
        LocalDate fechaVencimiento = calcularFechaVencimiento(fechaRegistro, diasHabilesLimit);
        return LocalDate.now().isAfter(fechaVencimiento);
    }
}
