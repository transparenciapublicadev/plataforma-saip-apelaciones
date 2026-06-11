package pe.gob.saip.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.ResolucionRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.storage.StorageDownloadResult;
import pe.gob.saip.backend.storage.StorageException;
import pe.gob.saip.backend.storage.StorageObjectMetadata;
import pe.gob.saip.backend.storage.StorageProvider;
import pe.gob.saip.backend.storage.StorageProviderType;
import pe.gob.saip.backend.storage.StorageUploadRequest;
import pe.gob.saip.backend.storage.StorageUploadResult;

@Service
public class DocumentoService {

    private final DocumentoRepository documentoRepository;
    private final SolicitudRepository solicitudRepository;
    private final ApelacionRepository apelacionRepository;
    private final ExpedienteTtaipRepository expedienteRepository;
    private final ResolucionRepository resolucionRepository;
    private final CedulaNotificacionRepository cedulaRepository;
    private final AutorizacionRecursosService autorizacion;
    private final Map<StorageProviderType, StorageProvider> providers;
    private final StorageProviderType activeProvider;

    public DocumentoService(
            DocumentoRepository documentoRepository,
            SolicitudRepository solicitudRepository,
            ApelacionRepository apelacionRepository,
            ExpedienteTtaipRepository expedienteRepository,
            ResolucionRepository resolucionRepository,
            CedulaNotificacionRepository cedulaRepository,
            AutorizacionRecursosService autorizacion,
            List<StorageProvider> providers,
            StorageProperties storageProperties) {
        this.documentoRepository = documentoRepository;
        this.solicitudRepository = solicitudRepository;
        this.apelacionRepository = apelacionRepository;
        this.expedienteRepository = expedienteRepository;
        this.resolucionRepository = resolucionRepository;
        this.cedulaRepository = cedulaRepository;
        this.autorizacion = autorizacion;
        this.providers = new EnumMap<>(StorageProviderType.class);
        providers.forEach(provider -> this.providers.put(provider.type(), provider));
        this.activeProvider = storageProperties.getProvider();
        if (!this.providers.containsKey(activeProvider)) {
            throw new IllegalStateException(
                    "No existe una implementación de StorageProvider para " + activeProvider);
        }
    }

    @Transactional
    public DocumentoMetadataDTO subir(MultipartFile file, DocumentoUploadRequest request) {
        validarCarga(file, request);

        Documento documento = new Documento();
        documento.setTipoDocumento(request.tipoDocumento());
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        documento.setCreadoPor(autorizacion.obtenerUsuarioActual());
        asociarRecurso(documento, request);

        StorageProvider provider = providerFor(activeProvider);
        StorageUploadResult upload;
        try (InputStream content = file.getInputStream()) {
            upload = provider.upload(new StorageUploadRequest(
                    file.getOriginalFilename(),
                    file.getContentType(),
                    file.getSize(),
                    content));
        } catch (IOException exception) {
            throw new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "No fue posible leer el documento recibido",
                    exception);
        }

        StorageObjectMetadata metadata = upload.metadata();
        documento.setNombreOriginal(metadata.originalFilename());
        documento.setContentType(metadata.contentType());
        documento.setSizeBytes(metadata.sizeBytes());
        documento.setHashSha256(metadata.hashSha256());
        documento.setStorageProvider(metadata.provider());
        documento.setStorageBucket(metadata.bucket());
        documento.setStorageKey(metadata.storageKey());

        try {
            return DocumentoMetadataDTO.from(documentoRepository.save(documento));
        } catch (RuntimeException exception) {
            try {
                provider.delete(metadata.storageKey());
            } catch (RuntimeException cleanupException) {
                exception.addSuppressed(cleanupException);
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public DocumentoMetadataDTO obtenerMetadata(Long documentoId) {
        Documento documento = buscarActivo(documentoId);
        verificarAcceso(documento);
        return DocumentoMetadataDTO.from(documento);
    }

    @Transactional(readOnly = true)
    public DocumentoDownloadDTO descargar(Long documentoId) {
        Documento documento = buscarActivo(documentoId);
        verificarAcceso(documento);

        StorageDownloadResult download = providerFor(documento.getStorageProvider())
                .download(documento.getStorageKey(), documento.getContentType());
        return new DocumentoDownloadDTO(
                documento.getNombreOriginal(),
                download.contentType(),
                download.sizeBytes(),
                download.content());
    }

    @Transactional
    public void eliminar(Long documentoId) {
        autorizacion.verificarAdministrador();
        Documento documento = buscarActivo(documentoId);
        providerFor(documento.getStorageProvider()).delete(documento.getStorageKey());
        documento.setEstado(Documento.EstadoDocumento.ELIMINADO);
        documentoRepository.save(documento);
    }

    private void validarCarga(MultipartFile file, DocumentoUploadRequest request) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("El archivo documental es obligatorio");
        }
        if (request == null || request.tipoDocumento() == null) {
            throw new IllegalArgumentException("El tipo de documento es obligatorio");
        }
        if (request.relationCount() != 1) {
            throw new IllegalArgumentException(
                    "El documento debe asociarse exactamente a un recurso de negocio");
        }
    }

    private void asociarRecurso(Documento documento, DocumentoUploadRequest request) {
        if (request.solicitudId() != null) {
            autorizacion.verificarSolicitudAccesible(request.solicitudId());
            documento.setSolicitud(buscarSolicitud(request.solicitudId()));
            return;
        }
        if (request.apelacionId() != null) {
            autorizacion.verificarApelacionAccesible(request.apelacionId());
            documento.setApelacion(buscarApelacion(request.apelacionId()));
            return;
        }

        autorizacion.verificarTtaipOAdministrador();
        if (request.expedienteTtaipId() != null) {
            documento.setExpedienteTtaip(buscarExpediente(request.expedienteTtaipId()));
        } else if (request.resolucionId() != null) {
            documento.setResolucion(buscarResolucion(request.resolucionId()));
        } else if (request.cedulaNotificacionId() != null) {
            documento.setCedulaNotificacion(buscarCedula(request.cedulaNotificacionId()));
        }
    }

    private void verificarAcceso(Documento documento) {
        if (documento.getSolicitud() != null) {
            autorizacion.verificarSolicitudAccesible(documento.getSolicitud());
            return;
        }
        if (documento.getRespuesta() != null) {
            autorizacion.verificarRespuestaAccesible(documento.getRespuesta().getIdRespuesta());
            return;
        }
        if (documento.getApelacion() != null) {
            autorizacion.verificarApelacionAccesible(documento.getApelacion());
            return;
        }
        if (documento.getExpedienteTtaip() != null) {
            autorizacion.verificarExpedienteTtaipAccesible(
                    documento.getExpedienteTtaip().getIdExpedienteTtaip());
            return;
        }
        if (documento.getResolucion() != null) {
            autorizacion.verificarApelacionAccesible(documento.getResolucion().getApelacion());
            return;
        }
        if (documento.getCedulaNotificacion() != null) {
            autorizacion.verificarApelacionAccesible(
                    documento.getCedulaNotificacion().getResolucion().getApelacion());
            return;
        }
        throw new IllegalStateException("El documento no tiene una relación de negocio válida");
    }

    private Documento buscarActivo(Long documentoId) {
        return documentoRepository.findByIdDocumentoAndEstado(
                        documentoId,
                        Documento.EstadoDocumento.ACTIVO)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Documento activo no encontrado con ID: " + documentoId));
    }

    private Solicitud buscarSolicitud(Long id) {
        return solicitudRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Solicitud SAIP no encontrada con ID: " + id));
    }

    private Apelacion buscarApelacion(Long id) {
        return apelacionRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Apelación no encontrada con ID: " + id));
    }

    private ExpedienteTtaip buscarExpediente(Long id) {
        return expedienteRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Expediente TTAIP no encontrado con ID: " + id));
    }

    private Resolucion buscarResolucion(Long id) {
        return resolucionRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Resolución no encontrada con ID: " + id));
    }

    private CedulaNotificacion buscarCedula(Long id) {
        return cedulaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Cédula de notificación no encontrada con ID: " + id));
    }

    private StorageProvider providerFor(StorageProviderType providerType) {
        StorageProvider provider = providers.get(providerType);
        if (provider == null) {
            throw new IllegalStateException(
                    "No existe un StorageProvider configurado para " + providerType);
        }
        return provider;
    }
}
