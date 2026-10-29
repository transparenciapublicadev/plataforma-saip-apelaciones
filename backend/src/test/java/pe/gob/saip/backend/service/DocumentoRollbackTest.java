package pe.gob.saip.backend.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.RespuestaRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.storage.StorageObjectMetadata;
import pe.gob.saip.backend.storage.StorageProvider;
import pe.gob.saip.backend.storage.StorageProviderType;
import pe.gob.saip.backend.storage.StorageUploadResult;

@ExtendWith(MockitoExtension.class)
class DocumentoRollbackTest {
    @Mock DocumentoRepository documentos;
    @Mock SolicitudRepository solicitudes;
    @Mock RespuestaRepository respuestas;
    @Mock ApelacionRepository apelaciones;
    @Mock ExpedienteTtaipRepository expedientes;
    @Mock ResolucionRepository resoluciones;
    @Mock CedulaNotificacionRepository cedulas;
    @Mock AutorizacionRecursosService autorizacion;
    @Mock StorageProvider storage;
    private DocumentoService service;

    @BeforeEach
    void setUp() {
        when(storage.type()).thenReturn(StorageProviderType.LOCAL);
        service = new DocumentoService(documentos, solicitudes, respuestas, apelaciones,
                expedientes, resoluciones, cedulas, autorizacion, List.of(storage), new StorageProperties());
        Solicitud solicitud = new Solicitud();
        solicitud.setIdSolicitud(10L);
        when(solicitudes.findById(10L)).thenReturn(Optional.of(solicitud));
        when(autorizacion.obtenerUsuarioActual()).thenReturn(new Usuario());
        when(storage.upload(any())).thenReturn(new StorageUploadResult(new StorageObjectMetadata(
                StorageProviderType.LOCAL, "local", "2026/test.txt", "precision.txt", "text/plain", 9,
                "a".repeat(64))));
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    @Test
    void removesUploadedObjectWhenLaterWorkRollsBackTheOuterTransaction() {
        successfulPersistence();
        upload();
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage).delete("2026/test.txt");
    }

    @Test
    void keepsUploadedObjectAfterCommit() {
        successfulPersistence();
        upload();
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(storage, never()).delete(any());
    }

    @Test
    void doesNotDeleteWhenTransactionOutcomeIsUnknown() {
        successfulPersistence();
        upload();
        complete(TransactionSynchronization.STATUS_UNKNOWN);
        verify(storage, never()).delete(any());
    }

    @Test
    void persistenceFailureAndRollbackCompensateOnlyOnce() {
        doThrow(new IllegalStateException("Simulated persistence failure")).when(documentos).save(any());
        org.assertj.core.api.Assertions.assertThatThrownBy(this::upload)
                .isInstanceOf(IllegalStateException.class);
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage, times(1)).delete("2026/test.txt");
    }

    private void upload() {
        service.subir(new MockMultipartFile("archivo", "precision.txt", "text/plain", "contenido".getBytes()),
                new DocumentoUploadRequest(Documento.TipoDocumento.SUBSANACION, 10L, null, null, null, null, null));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints={TransactionSynchronization.STATUS_ROLLED_BACK,TransactionSynchronization.STATUS_COMMITTED,TransactionSynchronization.STATUS_UNKNOWN})
    void clonedObjectUsesTheSameTransactionOutcomeCompensation(int status) {
        successfulPersistence();
        Documento original=new Documento();original.setIdDocumento(20L);original.setSolicitud(solicitudes.findById(10L).orElseThrow());
        original.setStorageProvider(StorageProviderType.LOCAL);original.setStorageKey("original.txt");original.setNombreOriginal("original.txt");
        original.setContentType("text/plain");original.setSizeBytes(9L);
        when(documentos.findByIdDocumentoAndEstado(20L,Documento.EstadoDocumento.ACTIVO)).thenReturn(Optional.of(original));
        when(storage.download("original.txt","text/plain")).thenReturn(new pe.gob.saip.backend.storage.StorageDownloadResult(
            new java.io.ByteArrayInputStream("contenido".getBytes()),"text/plain",9));
        service.clonar(20L,new DocumentoUploadRequest(Documento.TipoDocumento.SOLICITUD_ORIGINAL,10L,null,null,null,null,null));
        complete(status);
        verify(storage,times(status==TransactionSynchronization.STATUS_ROLLED_BACK?1:0)).delete("2026/test.txt");
    }

    private void successfulPersistence() {
        when(documentos.save(any())).thenAnswer(inv -> {
            Documento documento = inv.getArgument(0);
            documento.setIdDocumento(30L);
            return documento;
        });
    }

    private void complete(int status) {
        TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCompletion(status));
    }
}
