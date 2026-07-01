package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;

/**
 * DTO inmutable que encapsula el seguimiento de plazos legales de una solicitud SAIP.
 */
public record PlazoSeguimientoDTO(
    LocalDate fechaRegistro,
    LocalDate fechaVencimiento,
    long diasRestantes,
    boolean enSilencioAdministrativo
) {}
