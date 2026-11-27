package pe.gob.saip.backend.model.dto;

import java.util.List;

public record CalendarioAnioResumenDTO(
        int anio,
        int diasHabilesTotal,
        int feriadosLaborables,
        int noLaborablesLaborables,
        int suspensionesLaborables,
        List<DiaInhabilDTO> inhabiles
) {}
