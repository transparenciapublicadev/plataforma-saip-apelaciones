package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

import static pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA;

@Schema(description = "Ampliación de plazo SAIP con informe y cronograma de entregas parciales")
public record AmpliacionPlazoSolicitudDTO(
        Long id,
        Long solicitudId,
        String expediente,
        String motivoAmpliacion,
        String informeAmpliacion,
        String fechaSolicitudAmpliacion,
        String fechaNotificacionAmpliacion,
        String fechaLimiteOriginal,
        String fechaLimiteAmpliada,
        String estadoAmpliacion,
        String responsable,
        String trazabilidad,
        List<CronogramaEntregaParcialDTO> cronograma,
        boolean plazoOrdinarioVencido
) {
    public static AmpliacionPlazoSolicitudDTO from(AmpliacionPlazoSolicitud ampliacion) {
        return new AmpliacionPlazoSolicitudDTO(
                ampliacion.getId(),
                ampliacion.getSolicitud() != null ? ampliacion.getSolicitud().getId() : null,
                ampliacion.getSolicitud() != null ? ampliacion.getSolicitud().getExpediente() : null,
                ampliacion.getMotivoAmpliacion(),
                ampliacion.getInformeAmpliacion(),
                ampliacion.getFechaSolicitudAmpliacion() != null ? ampliacion.getFechaSolicitudAmpliacion().toString() : null,
                ampliacion.getFechaNotificacionAmpliacion() != null ? ampliacion.getFechaNotificacionAmpliacion().toString() : null,
                ampliacion.getFechaLimiteOriginal() != null ? ampliacion.getFechaLimiteOriginal().toString() : null,
                ampliacion.getFechaLimiteAmpliada() != null ? ampliacion.getFechaLimiteAmpliada().toString() : null,
                ampliacion.getEstadoAmpliacion() != null ? ampliacion.getEstadoAmpliacion().name() : null,
                ampliacion.getResponsable(),
                ampliacion.getTrazabilidad(),
                ampliacion.getCronograma() != null
                        ? ampliacion.getCronograma().stream()
                                .sorted(Comparator.comparing(CronogramaEntregaParcialSolicitud::getNumeroEntrega))
                                .map(CronogramaEntregaParcialDTO::from)
                                .toList()
                        : List.of(),
                ampliacion.getFechaLimiteOriginal() != null && LocalDate.now(ZONA_LIMA).isAfter(ampliacion.getFechaLimiteOriginal())
        );
    }
}
