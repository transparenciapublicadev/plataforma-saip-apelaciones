package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonInclude;
import pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.HistorialTtaip;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;
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
        @Schema(description = "Metadatos documentales seguros asociados directamente al expediente TTAIP")
        List<DocumentoMetadataDTO> documentos,
        List<ResolucionDTO> resoluciones,
        List<CedulaNotificacionDTO> cedulas,
        List<NotificacionTtaipDTO> notificaciones,
        List<HistorialTtaipDTO> historial,
        List<ReprocesoNotificacionDTO> reprocesos,
        List<DescargoEntidadTtaipDTO> descargosEntidad,
        List<SuspensionPlazoTtaipDTO> suspensionesPlazo,
        List<CumplimientoResolucionTtaipDTO> cumplimientosResolucion,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        EstadoCumplimientoDocumentalDTO cumplimientoDocumental
) {
    public record EstadoCumplimientoDocumentalDTO(LocalDateTime fechaEntrega, LocalDate fechaRemision, LocalDateTime fechaCierre) {}

    private static EstadoCumplimientoDocumentalDTO estadoCumplimientoDocumental(ExpedienteTtaip expediente) {
        if (expediente.getCumplimientosResolucion() == null || expediente.getApelacion() == null
                || expediente.getApelacion().getResolucion() == null) return null;
        Long resolucionId = expediente.getApelacion().getResolucion().getId();
        return expediente.getCumplimientosResolucion().stream()
                .filter(c -> c.getIdNotificacionInicio() != null && c.getFechaEntrega() != null
                        && Objects.equals(resolucionId, c.getResolucion().getId()))
                .findFirst()
                .map(c -> {
                    boolean cumplido = c.getEstadoCumplimiento() == CumplimientoResolucionTtaip.EstadoCumplimiento.CUMPLIDO
                            && c.getOperacionRemision() != null;
                    LocalDateTime cierre = cumplido && expediente.getApelacion().isResuelta() && expediente.getHistorial() != null
                            ? expediente.getHistorial().stream()
                                .filter(h -> h.getTipoEvento() == HistorialTtaip.TipoEvento.CAMBIO_ESTADO
                                        && ("CUMPLIMIENTO-" + c.getId()).equals(h.getReferencia())
                                        && expediente.getApelacion().getEstado().name().equals(h.getEstadoNuevo()))
                                .map(HistorialTtaip::getFechaEvento).filter(Objects::nonNull).min(LocalDateTime::compareTo).orElse(null)
                            : null;
                    return new EstadoCumplimientoDocumentalDTO(c.getFechaEntrega(), cumplido ? c.getFechaCumplimiento() : null, cierre);
                }).orElse(null);
    }

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
                DocumentoMetadataDTO.fromActive(expediente.getDocumentos() == null ? null : expediente.getDocumentos().stream()
                        .filter(d -> d.getPresentacionAdmision() == null).toList()),
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
                        ? expediente.getCumplimientosResolucion().stream()
                            .filter(cumplimiento -> cumplimiento.getIdNotificacionInicio() == null)
                            .map(CumplimientoResolucionTtaipDTO::from).toList()
                        : List.of(),
                estadoCumplimientoDocumental(expediente)
        );
    }
}
