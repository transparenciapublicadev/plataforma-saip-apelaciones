package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.LiquidacionCostoSolicitud;

@Schema(description = "Liquidación o cupón de pago para entrega física de información SAIP")
public record LiquidacionCostoSolicitudDTO(
        Long id,
        Long solicitudId,
        String expediente,
        String codigoLiquidacion,
        String monto,
        String moneda,
        String concepto,
        String fechaEmision,
        String fechaNotificacion,
        String fechaLimiteRecojo,
        String estadoLiquidacion,
        String medioNotificacion,
        String responsable,
        String observacion,
        String trazabilidad,
        String fechaPago,
        String fechaRecojo
) {
    public static LiquidacionCostoSolicitudDTO from(LiquidacionCostoSolicitud liquidacion) {
        return new LiquidacionCostoSolicitudDTO(
                liquidacion.getId(),
                liquidacion.getSolicitud() != null ? liquidacion.getSolicitud().getId() : null,
                liquidacion.getSolicitud() != null ? liquidacion.getSolicitud().getExpediente() : null,
                liquidacion.getCodigoLiquidacion(),
                liquidacion.getMonto() != null ? liquidacion.getMonto().toPlainString() : null,
                liquidacion.getMoneda(),
                liquidacion.getConcepto(),
                liquidacion.getFechaEmision() != null ? liquidacion.getFechaEmision().toString() : null,
                liquidacion.getFechaNotificacion() != null ? liquidacion.getFechaNotificacion().toString() : null,
                liquidacion.getFechaLimiteRecojo() != null ? liquidacion.getFechaLimiteRecojo().toString() : null,
                liquidacion.getEstadoLiquidacion() != null ? liquidacion.getEstadoLiquidacion().name() : null,
                liquidacion.getMedioNotificacion() != null ? liquidacion.getMedioNotificacion().name() : null,
                liquidacion.getResponsable(),
                liquidacion.getObservacion(),
                liquidacion.getTrazabilidad(),
                liquidacion.getFechaPago() != null ? liquidacion.getFechaPago().toString() : null,
                liquidacion.getFechaRecojo() != null ? liquidacion.getFechaRecojo().toString() : null
        );
    }
}
