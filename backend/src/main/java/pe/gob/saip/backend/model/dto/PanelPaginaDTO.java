package pe.gob.saip.backend.model.dto;
import java.util.List;
/** Bounded rows and aggregates from the same authorized account scope. */
public record PanelPaginaDTO<T>(List<T> contenido, int pagina, int tamano, long totalElementos,
    int totalPaginas, boolean ultima, PanelResumenDTO resumen, List<PanelOpcionDTO> entidades,
    List<PanelOpcionDTO> salas, boolean opcionesLimitadas, String alcance, String fuentePlazo) {}
