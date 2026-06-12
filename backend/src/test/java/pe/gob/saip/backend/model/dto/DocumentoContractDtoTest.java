package pe.gob.saip.backend.model.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.storage.StorageProviderType;
import tools.jackson.databind.json.JsonMapper;

class DocumentoContractDtoTest {

    @Test
    void saipAndRespuestaExposeOnlyActiveDocumentMetadata() {
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        Documento solicitudActivo = documentoActivo(101L);
        solicitudActivo.setSolicitud(solicitud);
        Documento solicitudEliminado = documentoActivo(102L);
        solicitudEliminado.setSolicitud(solicitud);
        solicitudEliminado.setEstado(Documento.EstadoDocumento.ELIMINADO);
        solicitud.setDocumentos(List.of(solicitudActivo, solicitudEliminado));

        Respuesta respuesta = new Respuesta();
        respuesta.setIdRespuesta(20L);
        Documento respuestaActivo = documentoActivo(201L);
        respuestaActivo.setRespuesta(respuesta);
        respuesta.setDocumentos(List.of(respuestaActivo));
        solicitud.setRespuesta(respuesta);

        SolicitudDTO dto = SolicitudDTO.from(solicitud);

        assertThat(dto.documentosMetadata()).singleElement().satisfies(documento -> {
            assertThat(documento.id()).isEqualTo(101L);
            assertThat(documento.solicitudId()).isEqualTo(10L);
        });
        assertThat(dto.respuesta().documentosMetadata()).singleElement().satisfies(documento -> {
            assertThat(documento.id()).isEqualTo(201L);
            assertThat(documento.respuestaId()).isEqualTo(20L);
        });
    }

    @Test
    void ttaipAggregateExposesResolutionCedulaAndExpedienteMetadata() {
        ExpedienteTtaip expediente = new ExpedienteTtaip();
        expediente.setIdExpedienteTtaip(30L);
        Documento expedienteDocumento = documentoActivo(301L);
        expedienteDocumento.setExpedienteTtaip(expediente);
        expediente.setDocumentos(List.of(expedienteDocumento));

        Resolucion resolucion = new Resolucion();
        resolucion.setIdResolucion(40L);
        Documento resolucionDocumento = documentoActivo(401L);
        resolucionDocumento.setResolucion(resolucion);
        resolucion.setDocumentos(List.of(resolucionDocumento));

        CedulaNotificacion cedula = new CedulaNotificacion();
        cedula.setIdCedula(50L);
        cedula.setResolucion(resolucion);
        Documento cedulaDocumento = documentoActivo(501L);
        cedulaDocumento.setCedulaNotificacion(cedula);
        cedula.setDocumentos(List.of(cedulaDocumento));
        resolucion.setCedulasNotificacion(List.of(cedula));
        expediente.setResoluciones(List.of(resolucion));

        ExpedienteTtaipDTO dto = ExpedienteTtaipDTO.from(expediente);

        assertThat(dto.documentos()).singleElement()
                .extracting(DocumentoMetadataDTO::expedienteTtaipId)
                .isEqualTo(30L);
        assertThat(dto.resoluciones()).singleElement().satisfies(resolucionDto -> {
            assertThat(resolucionDto.documentos()).singleElement()
                    .extracting(DocumentoMetadataDTO::resolucionId)
                    .isEqualTo(40L);
            assertThat(resolucionDto.cedulas()).singleElement()
                    .satisfies(cedulaDto -> assertThat(cedulaDto.documentos()).singleElement()
                            .extracting(DocumentoMetadataDTO::cedulaNotificacionId)
                            .isEqualTo(50L));
        });
    }

    @Test
    void notificacionExposesCedulaIdAndItsSafeDocumentMetadata() {
        CedulaNotificacion cedula = new CedulaNotificacion();
        cedula.setIdCedula(50L);
        Documento documento = documentoActivo(501L);
        documento.setCedulaNotificacion(cedula);
        cedula.setDocumentos(List.of(documento));

        NotificacionTtaip notificacion = new NotificacionTtaip();
        notificacion.setIdNotificacion(60L);
        notificacion.setCedula(cedula);

        NotificacionTtaipDTO dto = NotificacionTtaipDTO.from(notificacion);

        assertThat(dto.cedulaId()).isEqualTo(50L);
        assertThat(dto.documentosCedula()).singleElement()
                .extracting(DocumentoMetadataDTO::cedulaNotificacionId)
                .isEqualTo(50L);
    }

    @Test
    void legacyDocumentoDtoNeverSerializesPhysicalPath() throws Exception {
        DocumentoDTO dto = new DocumentoDTO(
                1L,
                "documento.pdf",
                "C:/private/storage/documento.pdf",
                "application/pdf",
                100L,
                "DOCUMENTO_ADJUNTO",
                null);

        String json = JsonMapper.builder().build().writeValueAsString(dto);

        assertThat(json).doesNotContain("rutaArchivo", "private/storage");
    }

    private Documento documentoActivo(Long id) {
        Documento documento = new Documento();
        documento.setIdDocumento(id);
        documento.setNombreOriginal("documento-" + id + ".pdf");
        documento.setContentType("application/pdf");
        documento.setSizeBytes(100L);
        documento.setHashSha256("a".repeat(64));
        documento.setStorageProvider(StorageProviderType.S3_COMPATIBLE);
        documento.setStorageBucket("private-bucket");
        documento.setStorageKey("private/" + id);
        documento.setTipoDocumento(Documento.TipoDocumento.DOCUMENTO_ADJUNTO);
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        return documento;
    }
}
