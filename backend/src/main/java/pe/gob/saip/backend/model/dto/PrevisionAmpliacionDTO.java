package pe.gob.saip.backend.model.dto;

import java.time.LocalDate;

public record PrevisionAmpliacionDTO(LocalDate hoy, LocalDate fechaMaximaComunicacion,
        LocalDate fechaLimiteAmpliada, boolean disponible, boolean requiereCronograma) {
}
