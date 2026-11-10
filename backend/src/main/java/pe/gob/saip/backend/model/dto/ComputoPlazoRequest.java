package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;

public record ComputoPlazoRequest(
        LocalDate fechaInicio,
        Integer dias,
        String tipo,
        Long entidadId
) {}
