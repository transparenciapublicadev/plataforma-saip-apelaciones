package pe.gob.saip.backend.model.dto;

import java.util.List;
import java.util.Map;

public record CalendarioConfigDTO(
        int version,
        List<FeriadoDTO> feriados,
        boolean semanaSanta,
        Map<String, Integer> plazos,
        TarifasDTO tarifas,
        List<CambioCalendarioDTO> historial,
        ActualizadoDTO actualizado
) {
    public record TarifasDTO(Double copiaSimple, Double copiaCertificada, Double soporteDigital) {}
    public record CambioCalendarioDTO(String fecha, String usuario, String detalle, String norma) {}
    public record ActualizadoDTO(String fecha, String usuario) {}
}
