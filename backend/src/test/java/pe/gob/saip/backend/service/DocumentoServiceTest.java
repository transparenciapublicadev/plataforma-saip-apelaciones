package pe.gob.saip.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
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
                        null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exactamente");

        verifyNoInteractions(documentoRepository, solicitudRepository, autorizacion);
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

        service.eliminar(99L);

        verify(autorizacion).verificarAdministrador();
        verify(storageProvider).delete("2026/06/opaque.txt");
        assertThat(documento.getEstado()).isEqualTo(Documento.EstadoDocumento.ELIMINADO);
        verify(documentoRepository).save(documento);
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
