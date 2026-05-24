package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;

@Schema(description = "Entrega parcial programada dentro de una ampliación de plazo SAIP")
public record CronogramaEntregaParcialDTO(
        Long id,
        Long ampliacionId,
        Integer numeroEntrega,
        String descripcion,
        String fechaProgramada,
        String estado,
        String fechaEntregaReal,
        String observacion
) {
    public static CronogramaEntregaParcialDTO from(CronogramaEntregaParcialSolicitud entrega) {
        return new CronogramaEntregaParcialDTO(
                entrega.getId(),
                entrega.getAmpliacion() != null ? entrega.getAmpliacion().getId() : null,
                entrega.getNumeroEntrega(),
                entrega.getDescripcion(),
                entrega.getFechaProgramada() != null ? entrega.getFechaProgramada().toString() : null,
                entrega.getEstado() != null ? entrega.getEstado().name() : null,
                entrega.getFechaEntregaReal() != null ? entrega.getFechaEntregaReal().toString() : null,
                entrega.getObservacion()
        );
    }
}
