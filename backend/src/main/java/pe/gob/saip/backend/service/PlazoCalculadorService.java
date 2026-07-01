package pe.gob.saip.backend.service;

import java.time.LocalDate;

/**
 * Servicio central de cálculo de plazos legales en días hábiles (excluyendo fines de semana).
 */
public interface PlazoCalculadorService {

    /**
     * Calcula la fecha de vencimiento de un plazo legal basado en días hábiles.
     *
     * @param fechaRegistro     Fecha de registro del documento.
     * @param diasHabilesLimit   Límite de días hábiles.
     * @return La fecha de vencimiento calculada.
     */
    LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit);

    /**
     * Verifica si la fecha actual ha excedido la fecha de vencimiento calculada (Silencio Administrativo).
     *
     * @param fechaRegistro     Fecha de registro del documento.
     * @param diasHabilesLimit   Límite de días hábiles.
     * @return true si la fecha actual supera el vencimiento, false en caso contrario.
     */
    boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit);
}
