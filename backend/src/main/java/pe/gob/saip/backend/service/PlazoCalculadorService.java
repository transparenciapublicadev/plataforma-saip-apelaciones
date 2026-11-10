package pe.gob.saip.backend.service;

import pe.gob.saip.backend.model.dto.CalendarioAnioResumenDTO;
import pe.gob.saip.backend.model.dto.DiaInhabilDTO;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio central de cómputo de plazos legales, días hábiles y calendario oficial.
 */
public interface PlazoCalculadorService {

    // 1. Cómputo de fecha de vencimiento
    LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit);
    LocalDate calcularFechaVencimiento(LocalDate fechaRegistro, int diasHabilesLimit, Long entidadId);

    // 2. Control de exceso de plazo / silencio administrativo negativo
    boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit);
    boolean verificarExcesoDePlazo(LocalDate fechaRegistro, int diasHabilesLimit, Long entidadId);

    // 3. Inspección de fechas y días hábiles
    boolean esDiaHabil(LocalDate fecha);
    boolean esDiaHabil(LocalDate fecha, Long entidadId);
    String motivoInhabil(LocalDate fecha, Long entidadId);
    LocalDate siguienteDiaHabil(LocalDate fecha, Long entidadId);
    LocalDate recepcionEfectiva(LocalDate fecha, Long entidadId);

    // 4. Conteo de días hábiles y días restantes
    int contarDiasHabiles(LocalDate desde, LocalDate hasta);
    int contarDiasHabiles(LocalDate desde, LocalDate hasta, Long entidadId);
    int diasHabilesRestantes(LocalDate fechaLimite);
    int diasHabilesRestantes(LocalDate fechaLimite, Long entidadId);

    // 5. Reloj oficial y consultas anuales
    LocalDate hoy();
    LocalDateTime ahora();
    List<DiaInhabilDTO> obtenerInhabilesDelAnio(int anio);
    CalendarioAnioResumenDTO obtenerResumenAnio(int anio);

    // 6. Invalida la memoria caché en cambios del calendario
    void invalidarCache();
}
