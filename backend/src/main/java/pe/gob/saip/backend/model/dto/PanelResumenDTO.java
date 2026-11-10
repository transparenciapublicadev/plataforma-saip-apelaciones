package pe.gob.saip.backend.model.dto;
import java.util.Map;
/** Counts cover the authorized scope, before page/search filters; they are not delivery evidence. */
public record PanelResumenDTO(long total, Map<String,Long> porEstado, Map<String,Long> porEtapa,
    Map<String,Long> porResultado, Map<String,Long> porTipoInformacion, Map<String,Long> porEntidad) {}
