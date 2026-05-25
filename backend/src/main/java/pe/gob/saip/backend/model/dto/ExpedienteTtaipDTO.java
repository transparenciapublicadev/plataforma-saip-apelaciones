package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;

import java.util.List;

@Schema(description = "Expediente TTAIP como agregado principal de la segunda instancia")
public record ExpedienteTtaipDTO(
        Long id,
        String numeroExpediente,
        String estado,
        String fechaApertura,
        String fechaActualizacion,
        String fechaPrimeraCalificacion,
        String fechaSegundaCalificacion,
        String fechaResolucionFinal,
        String fechaLimiteResolucion,
        String trazabilidadMinima,
        SalaTtaipDTO sala,
        List<MiembroTTAIPDTO> miembros,
        List<ResolucionDTO> resoluciones,
        List<CedulaNotificacionDTO> cedulas,
        List<NotificacionTtaipDTO> notificaciones,
        List<HistorialTtaipDTO> historial,
        List<ReprocesoNotificacionDTO> reprocesos,
        List<DescargoEntidadTtaipDTO> descargosEntidad,
        List<SuspensionPlazoTtaipDTO> suspensionesPlazo,
        List<CumplimientoResolucionTtaipDTO> cumplimientosResolucion
) {
    public static ExpedienteTtaipDTO from(ExpedienteTtaip expediente) {
        List<ResolucionDTO> resoluciones = expediente.getResoluciones() != null
                ? expediente.getResoluciones().stream().map(ResolucionDTO::from).toList()
                : List.of();
        List<CedulaNotificacionDTO> cedulas = expediente.getResoluciones() != null
                ? expediente.getResoluciones().stream()
                    .flatMap(resolucion -> resolucion.getCedulasNotificacion() != null
                            ? resolucion.getCedulasNotificacion().stream()
                            : java.util.stream.Stream.empty())
                    .map(CedulaNotificacionDTO::from)
                    .toList()
                : List.of();

        return new ExpedienteTtaipDTO(
                expediente.getId(),
                expediente.getNumeroExpediente(),
                expediente.getEstado() != null ? expediente.getEstado().name() : null,
                expediente.getFechaApertura() != null ? expediente.getFechaApertura().toString() : null,
                expediente.getFechaActualizacion() != null ? expediente.getFechaActualizacion().toString() : null,
                expediente.getFechaPrimeraCalificacion() != null ? expediente.getFechaPrimeraCalificacion().toString() : null,
                expediente.getFechaSegundaCalificacion() != null ? expediente.getFechaSegundaCalificacion().toString() : null,
                expediente.getFechaResolucionFinal() != null ? expediente.getFechaResolucionFinal().toString() : null,
                expediente.getFechaLimiteResolucion() != null ? expediente.getFechaLimiteResolucion().toString() : null,
                expediente.getTrazabilidadMinima(),
                expediente.getSala() != null ? SalaTtaipDTO.from(expediente.getSala()) : null,
                expediente.getMiembrosAsignados() != null
                        ? expediente.getMiembrosAsignados().stream().map(MiembroTTAIPDTO::from).toList()
                        : List.of(),
                resoluciones,
                cedulas,
                expediente.getNotificaciones() != null
                        ? expediente.getNotificaciones().stream().map(NotificacionTtaipDTO::from).toList()
                        : List.of(),
                expediente.getHistorial() != null
                        ? expediente.getHistorial().stream().map(HistorialTtaipDTO::from).toList()
                        : List.of(),
                expediente.getReprocesos() != null
                        ? expediente.getReprocesos().stream().map(ReprocesoNotificacionDTO::from).toList()
                        : List.of(),
                expediente.getDescargosEntidad() != null
                        ? expediente.getDescargosEntidad().stream().map(DescargoEntidadTtaipDTO::from).toList()
                        : List.of(),
                expediente.getSuspensionesPlazo() != null
                        ? expediente.getSuspensionesPlazo().stream().map(SuspensionPlazoTtaipDTO::from).toList()
                        : List.of(),
                expediente.getCumplimientosResolucion() != null
                        ? expediente.getCumplimientosResolucion().stream().map(CumplimientoResolucionTtaipDTO::from).toList()
                        : List.of()
        );
    }
}
