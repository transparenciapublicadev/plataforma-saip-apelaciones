package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Datos públicos agregados para la portada de la plataforma")
public record PortalPublicoDTO(
        PortalMetricasDTO metricas,
        List<PortalEjemploDTO> ejemplosSolicitud,
        List<PortalFaqDTO> preguntasFrecuentes,
        List<PortalDistribucionDTO> apelacionesPorEntidad,
        List<PortalTendenciaDTO> tendenciaMensual,
        List<PortalMiembroTTAIPDTO> miembrosTTAIP
) {

    public record PortalMetricasDTO(
            long saipPresentadas,
            long respondidas,
            long apelaciones,
            long entidades,
            long personasApelantes,
            double tasaResolucion
    ) {}

    public record PortalDistribucionDTO(
            String etiqueta,
            long valor
    ) {}

    public record PortalEjemploDTO(
            String icono,
            String texto
    ) {}

    public record PortalFaqDTO(
            String pregunta,
            String respuesta
    ) {}

    public record PortalTendenciaDTO(
            int mes,
            String etiqueta,
            long solicitudes,
            long apelaciones
    ) {}

    public record PortalMiembroTTAIPDTO(
            Long id,
            String nombre,
            String cargo,
            String sala,
            String especialidad,
            String email,
            String periodoInicio,
            String periodoFin,
            Boolean presidenteTribunal
    ) {}
}
