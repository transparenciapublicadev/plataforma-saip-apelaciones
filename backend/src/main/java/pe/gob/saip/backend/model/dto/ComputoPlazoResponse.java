package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;

public record ComputoPlazoResponse(
        LocalDate fechaInicio,
        LocalDate fechaVencimiento,
        int diasHabilesRestantes,
        boolean esDiaHabil,
        String motivoInhabil
) {}
