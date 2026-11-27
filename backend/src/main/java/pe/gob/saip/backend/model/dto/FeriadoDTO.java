package pe.gob.saip.backend.model.dto;

import java.util.List;

public record FeriadoDTO(
        String id,
        String nombre,
        String tipo,
        Boolean recurrente,
        String fecha,
        String hasta,
        String mmdd,
        String baseLegal,
        Boolean activo,
        String origen,
        Boolean alcanceNacional,
        List<EntidadRefDTO> entidades
) {
    public record EntidadRefDTO(String id, String nombre) {}
}
