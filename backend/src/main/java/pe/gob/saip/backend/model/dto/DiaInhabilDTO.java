package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;

public record DiaInhabilDTO(
        LocalDate fecha,
        String nombre,
        String tipo,
        Boolean movil,
        String feriadoId,
        String baseLegal
) {}
