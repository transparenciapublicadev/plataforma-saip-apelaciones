package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.access.AccessDeniedException;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoRelacionRequest;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.RespuestaRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.storage.StorageDownloadResult;
import pe.gob.saip.backend.storage.StorageObjectMetadata;
import pe.gob.saip.backend.storage.StorageProvider;
import pe.gob.saip.backend.storage.StorageProviderType;
import pe.gob.saip.backend.storage.StorageUploadResult;

@ExtendWith(MockitoExtension.class)
class DocumentoServiceTest {

    @Mock
    private DocumentoRepository documentoRepository;
    @Mock
    private SolicitudRepository solicitudRepository;
    @Mock
    private RespuestaRepository respuestaRepository;
    @Mock
    private ApelacionRepository apelacionRepository;
    @Mock
    private ExpedienteTtaipRepository expedienteRepository;
    @Mock
    private ResolucionRepository resolucionRepository;
    @Mock
    private CedulaNotificacionRepository cedulaRepository;
    @Mock
    private AutorizacionRecursosService autorizacion;
    @Mock
    private StorageProvider storageProvider;

    private DocumentoService service;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.setProvider(StorageProviderType.LOCAL);
        when(storageProvider.type()).thenReturn(StorageProviderType.LOCAL);
        service = new DocumentoService(
                documentoRepository,
                solicitudRepository,
                respuestaRepository,
                apelacionRepository,
                expedienteRepository,
                resolucionRepository,
                cedulaRepository,
                autorizacion,
                List.of(storageProvider),
                properties);
    }

    @Test
    void uploadPersistsOnlyMetadataAndAssociatesSolicitud() {
        byte[] content = "%PDF-1.4\nprueba".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "solicitud.pdf",
                "application/pdf",
                content);
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(4L);

        when(autorizacion.obtenerUsuarioActual()).thenReturn(usuario);
        when(solicitudRepository.findById(10L)).thenReturn(Optional.of(solicitud));
        when(storageProvider.upload(any())).thenReturn(new StorageUploadResult(
                new StorageObjectMetadata(
                        StorageProviderType.LOCAL,
                        "local",
                        "2026/06/opaque.pdf",
                        "solicitud.pdf",
                        "application/pdf",
                        content.length,
                        "a".repeat(64))));
        when(documentoRepository.save(any())).thenAnswer(invocation -> {
            Documento documento = invocation.getArgument(0);
            documento.setIdDocumento(99L);
            return documento;
        });

        DocumentoMetadataDTO result = service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.SOLICITUD_ORIGINAL,
                        10L,
                        null,
                        null,
                        null,
                        null,
                        null));

        assertThat(result.id()).isEqualTo(99L);
        assertThat(result.nombreOriginal()).isEqualTo("solicitud.pdf");
        assertThat(result.solicitudId()).isEqualTo(10L);
        assertThat(result.hashSha256()).hasSize(64);

        ArgumentCaptor<Documento> captor = ArgumentCaptor.forClass(Documento.class);
        verify(documentoRepository).save(captor.capture());
        assertThat(captor.getValue().getStorageKey()).isEqualTo("2026/06/opaque.pdf");
        assertThat(captor.getValue().getCreadoPor()).isSameAs(usuario);
        verify(autorizacion).verificarSolicitudAccesible(10L);
    }

    @Test
    void uploadRejectsMissingOrAmbiguousBusinessRelationBeforeStorage() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "documento.txt",
                "text/plain",
                "contenido".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.DOCUMENTO_ADJUNTO,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactamente");

        assertThatThrownBy(() -> service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.DOCUMENTO_ADJUNTO,
                        1L,
                        2L,
                        null,
                        null,
                        null,
                        null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactamente");

        verifyNoInteractions(documentoRepository, solicitudRepository, autorizacion);
    }

    @Test
    void uploadAssociatesRespuestaOnlyAfterInstitutionalOwnershipValidation() {
        byte[] content = "respuesta".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "respuesta.txt",
                "text/plain",
                content);
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        Respuesta respuesta = new Respuesta();
        respuesta.setIdRespuesta(20L);
        respuesta.setSolicitud(solicitud);
        Usuario usuario = new Usuario();
        usuario.setIdUsuario(4L);

        when(autorizacion.obtenerUsuarioActual()).thenReturn(usuario);
        when(respuestaRepository.findById(20L)).thenReturn(Optional.of(respuesta));
        when(storageProvider.upload(any())).thenReturn(new StorageUploadResult(
                new StorageObjectMetadata(
                        StorageProviderType.LOCAL,
                        "local",
                        "2026/06/respuesta.txt",
                        "respuesta.txt",
                        "text/plain",
                        content.length,
                        "b".repeat(64))));
        when(documentoRepository.save(any())).thenAnswer(invocation -> {
            Documento documento = invocation.getArgument(0);
            documento.setIdDocumento(100L);
            return documento;
        });

        DocumentoMetadataDTO result = service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.RESPUESTA_ENTIDAD,
                        null,
                        20L,
                        null,
                        null,
                        null,
                        null));

        assertThat(result.respuestaId()).isEqualTo(20L);
        verify(autorizacion).verificarSolicitudInstitucional(10L);

        ArgumentCaptor<Documento> captor = ArgumentCaptor.forClass(Documento.class);
        verify(documentoRepository).save(captor.capture());
        assertThat(captor.getValue().getRespuesta()).isSameAs(respuesta);
    }

    @Test
    void listByRespuestaChecksOwnershipAndReturnsOnlyActiveRepositoryResults() {
        Documento documento = documentoActivo();
        Respuesta respuesta = new Respuesta();
        respuesta.setIdRespuesta(20L);
        documento.setRespuesta(respuesta);
        when(documentoRepository.findByRespuesta_IdRespuestaAndEstadoOrderByFechaCreacionDesc(
                20L,
                Documento.EstadoDocumento.ACTIVO))
                .thenReturn(List.of(documento));

        List<DocumentoMetadataDTO> result = service.listarPorRelacion(new DocumentoRelacionRequest(
                null,
                20L,
                null,
                null,
                null,
                null));

        assertThat(result).singleElement().satisfies(metadata -> {
            assertThat(metadata.id()).isEqualTo(99L);
            assertThat(metadata.respuestaId()).isEqualTo(20L);
        });
        verify(autorizacion).verificarRespuestaAccesible(20L);
    }

    @Test
    void listRejectsMissingOrAmbiguousRelationBeforeRepositoryAccess() {
        assertThatThrownBy(() -> service.listarPorRelacion(new DocumentoRelacionRequest(
                null,
                null,
                null,
                null,
                null,
                null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactamente");

        assertThatThrownBy(() -> service.listarPorRelacion(new DocumentoRelacionRequest(
                10L,
                20L,
                null,
                null,
                null,
                null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactamente");

        verifyNoInteractions(documentoRepository);
    }

    @Test
    void listStopsBeforeRepositoryWhenOwnershipIsDenied() {
        doThrow(new AccessDeniedException("recurso ajeno"))
                .when(autorizacion)
                .verificarRespuestaAccesible(20L);

        assertThatThrownBy(() -> service.listarPorRelacion(new DocumentoRelacionRequest(
                null,
                20L,
                null,
                null,
                null,
                null)))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(documentoRepository);
    }

    @Test
    void downloadChecksOwnershipBeforeOpeningProvider() throws Exception {
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        Documento documento = documentoActivo();
        documento.setSolicitud(solicitud);
        when(documentoRepository.findByIdDocumentoAndEstado(99L, Documento.EstadoDocumento.ACTIVO))
                .thenReturn(Optional.of(documento));
        when(storageProvider.download("2026/06/opaque.txt", "text/plain"))
                .thenReturn(new StorageDownloadResult(
                        new ByteArrayInputStream("contenido".getBytes(StandardCharsets.UTF_8)),
                        "text/plain",
                        9));

        DocumentoDownloadDTO result = service.descargar(99L);

        assertThat(result.content().readAllBytes()).isEqualTo("contenido".getBytes(StandardCharsets.UTF_8));
        verify(autorizacion).verificarSolicitudAccesible(solicitud);
    }

    @Test
    void deleteRequiresAdministratorAndKeepsMetadataAsDeleted() {
        Documento documento = documentoActivo();
        when(documentoRepository.findByIdDocumentoAndEstado(99L, Documento.EstadoDocumento.ACTIVO))
                .thenReturn(Optional.of(documento));

        when(documentoRepository.idsPorObjetoYEstado(StorageProviderType.LOCAL, documento.getStorageKey(),
                Documento.EstadoDocumento.ACTIVO)).thenReturn(List.of(99L));

        service.eliminar(99L);

        verify(autorizacion).verificarAdministrador();
        verify(storageProvider).delete("2026/06/opaque.txt");
        assertThat(documento.getEstado()).isEqualTo(Documento.EstadoDocumento.ELIMINADO);
        verify(documentoRepository).save(documento);
    }

    @Test
    void eliminarConReferenciaEncauzadaConservaElObjetoFisico() {
        Documento documento = documentoActivo();
        when(documentoRepository.findByIdDocumentoAndEstado(99L, Documento.EstadoDocumento.ACTIVO))
                .thenReturn(Optional.of(documento));
        when(documentoRepository.idsPorObjetoYEstado(StorageProviderType.LOCAL, documento.getStorageKey(),
                Documento.EstadoDocumento.ACTIVO)).thenReturn(List.of(99L, 100L));

        service.eliminar(99L);

        verify(documentoRepository).findFirstByStorageProviderAndStorageKeyOrderByIdDocumentoAsc(
                StorageProviderType.LOCAL, documento.getStorageKey());
        verify(storageProvider, never()).delete(anyString());
        assertThat(documento.getEstado()).isEqualTo(Documento.EstadoDocumento.ELIMINADO);
        verify(documentoRepository).save(documento);
    }

    @Test
    void subir_debeLanzarConflictoEstado_cuandoSolicitudEstaRespondida() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "documento.pdf",
                "application/pdf",
                "dummy content".getBytes(StandardCharsets.UTF_8));
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);

        when(solicitudRepository.findById(10L)).thenReturn(Optional.of(solicitud));

        assertThatThrownBy(() -> service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.DOCUMENTO_ADJUNTO,
                        10L,
                        null,
                        null,
                        null,
                        null,
                        null)))
                .isInstanceOf(ConflictoEstadoException.class)
                .hasMessageContaining("No se pueden adjuntar documentos a una solicitud en estado RESPONDIDA");
    }

    @Test
    void subir_debeLanzarConflictoEstado_cuandoApelacionEstaResuelta() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "documento.pdf",
                "application/pdf",
                "dummy content".getBytes(StandardCharsets.UTF_8));
        Apelacion apelacion = new Apelacion();
        apelacion.setIdApelacion(20L);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);

        when(apelacionRepository.findById(20L)).thenReturn(Optional.of(apelacion));

        assertThatThrownBy(() -> service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.DOCUMENTO_ADJUNTO,
                        null,
                        null,
                        20L,
                        null,
                        null,
                        null)))
                .isInstanceOf(ConflictoEstadoException.class)
                .hasMessageContaining("No se pueden adjuntar documentos a una apelación ya resuelta/cerrada.");
    }

    @Test
    void subir_debePermitirCarga_cuandoSeAsociaARespuestaDeSolicitudRespondida() {
        byte[] content = "%PDF-1.4\nprueba".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "respuesta.pdf",
                "application/pdf",
                content);
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);

        Respuesta respuesta = new Respuesta();
        respuesta.setIdRespuesta(30L);
        respuesta.setSolicitud(solicitud);

        Usuario usuario = new Usuario();
        usuario.setIdUsuario(4L);

        when(autorizacion.obtenerUsuarioActual()).thenReturn(usuario);
        when(respuestaRepository.findById(30L)).thenReturn(Optional.of(respuesta));
        when(storageProvider.upload(any())).thenReturn(new StorageUploadResult(
                new StorageObjectMetadata(
                        StorageProviderType.LOCAL,
                        "local",
                        "2026/06/opaque.pdf",
                        "respuesta.pdf",
                        "application/pdf",
                        content.length,
                        "a".repeat(64))));
        when(documentoRepository.save(any())).thenAnswer(invocation -> {
            Documento doc = invocation.getArgument(0);
            doc.setIdDocumento(99L);
            return doc;
        });

        pe.gob.saip.backend.model.dto.DocumentoMetadataDTO dto = service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.RESPUESTA_ENTIDAD,
                        null,
                        30L,
                        null,
                        null,
                        null,
                        null));

        assertThat(dto).isNotNull();
        assertThat(dto.nombreOriginal()).isEqualTo("respuesta.pdf");
    }

    @Test
    void subir_debePermitirCarga_cuandoSeAsociaAResolucionDeApelacionResuelta() {
        byte[] content = "%PDF-1.4\nprueba".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "resolucion.pdf",
                "application/pdf",
                content);
        Apelacion apelacion = new Apelacion();
        apelacion.setIdApelacion(20L);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);

        Resolucion resolucion = new Resolucion();
        resolucion.setIdResolucion(40L);
        resolucion.setApelacion(apelacion);

        Usuario usuario = new Usuario();
        usuario.setIdUsuario(4L);

        when(autorizacion.obtenerUsuarioActual()).thenReturn(usuario);
        when(resolucionRepository.findById(40L)).thenReturn(Optional.of(resolucion));
        when(storageProvider.upload(any())).thenReturn(new StorageUploadResult(
                new StorageObjectMetadata(
                        StorageProviderType.LOCAL,
                        "local",
                        "2026/06/opaque.pdf",
                        "resolucion.pdf",
                        "application/pdf",
                        content.length,
                        "a".repeat(64))));
        when(documentoRepository.save(any())).thenAnswer(invocation -> {
            Documento doc = invocation.getArgument(0);
            doc.setIdDocumento(99L);
            return doc;
        });

        pe.gob.saip.backend.model.dto.DocumentoMetadataDTO dto = service.subir(
                file,
                new DocumentoUploadRequest(
                        Documento.TipoDocumento.RESOLUCION_TTAIP,
                        null,
                        null,
                        null,
                        null,
                        40L,
                        null));

        assertThat(dto).isNotNull();
        assertThat(dto.nombreOriginal()).isEqualTo("resolucion.pdf");
    }


    @Test
    void copiarDocumentosDelAdministrado_conservaOrigenYOmiteLaRespuestaDeLaEntidad() {
        Entidad origenEntidad = new Entidad();
        origenEntidad.setNombre("Ministerio de Educación");
        Solicitud origen = new Solicitud();
        origen.setIdSolicitud(8L);
        origen.setExpediente("SAIP-2026-10008");
        origen.setEntidad(origenEntidad);
        Solicitud destino = new Solicitud();
        destino.setIdSolicitud(9L);
        destino.setExpediente("SAIP-2026-10009");

        Documento precision = documentoActivo();
        precision.setIdDocumento(1L);
        precision.setNombreOriginal("precision.pdf");
        precision.setTipoDocumento(Documento.TipoDocumento.SUBSANACION);
        precision.setStorageKey("2026/11/precision.pdf");
        precision.setSolicitud(origen);

        Documento respuesta = documentoActivo();
        respuesta.setIdDocumento(2L);
        respuesta.setTipoDocumento(Documento.TipoDocumento.RESPUESTA_ENTIDAD);
        respuesta.setStorageKey("2026/11/respuesta.pdf");
        respuesta.setSolicitud(origen);
        respuesta.setRespuesta(new Respuesta());

        Documento informe = documentoActivo();
        informe.setIdDocumento(3L);
        informe.setTipoDocumento(Documento.TipoDocumento.INFORME);
        informe.setStorageKey("2026/11/informe.pdf");
        informe.setSolicitud(origen);

        when(documentoRepository.findBySolicitud_IdSolicitudAndEstadoOrderByFechaCreacionDesc(
                8L, Documento.EstadoDocumento.ACTIVO)).thenReturn(List.of(precision, respuesta, informe));
        when(documentoRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        when(documentoRepository.idsPorObjetoYEstado(StorageProviderType.LOCAL, precision.getStorageKey(),
                Documento.EstadoDocumento.ACTIVO)).thenReturn(List.of(1L));

        service.copiarDocumentosDelAdministrado(origen, destino);

        ArgumentCaptor<Documento> copiado = ArgumentCaptor.forClass(Documento.class);
        verify(documentoRepository, times(1)).save(copiado.capture());
        assertThat(copiado.getValue().getSolicitud()).isSameAs(destino);
        assertThat(copiado.getValue().getTipoDocumento()).isEqualTo(Documento.TipoDocumento.SUBSANACION);
        assertThat(copiado.getValue().getStorageKey()).isEqualTo("2026/11/precision.pdf");
        assertThat(copiado.getValue().getExpedienteOrigen()).isEqualTo("SAIP-2026-10008");
        assertThat(copiado.getValue().getEntidadOrigen()).isEqualTo("Ministerio de Educación");
        assertThat(copiado.getValue().getRespuesta()).isNull();
    }

    private Documento documentoActivo() {
        Documento documento = new Documento();
        documento.setIdDocumento(99L);
        documento.setNombreOriginal("documento.txt");
        documento.setContentType("text/plain");
        documento.setSizeBytes(9L);
        documento.setStorageProvider(StorageProviderType.LOCAL);
        documento.setStorageKey("2026/06/opaque.txt");
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        return documento;
    }
}
