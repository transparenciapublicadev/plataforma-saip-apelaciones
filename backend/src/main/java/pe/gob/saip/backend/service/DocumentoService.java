package pe.gob.saip.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoDownloadDTO;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoRelacionRequest;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CedulaNotificacionRepository;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.RespuestaRepository;
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

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentoService.class);

    private final DocumentoRepository documentoRepository;
    private final SolicitudRepository solicitudRepository;
    private final RespuestaRepository respuestaRepository;
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
            RespuestaRepository respuestaRepository,
            ApelacionRepository apelacionRepository,
            ExpedienteTtaipRepository expedienteRepository,
            ResolucionRepository resolucionRepository,
            CedulaNotificacionRepository cedulaRepository,
            AutorizacionRecursosService autorizacion,
            List<StorageProvider> providers,
            StorageProperties storageProperties) {
        this.documentoRepository = documentoRepository;
        this.solicitudRepository = solicitudRepository;
        this.respuestaRepository = respuestaRepository;
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
        validarEstadoEntidadAsociada(request);

        Documento documento = new Documento();
        documento.setTipoDocumento(request.tipoDocumento());
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        documento.setCreadoPor(autorizacion.obtenerUsuarioActual());
        asociarRecurso(documento, request);
        return DocumentoMetadataDTO.from(guardarArchivo(file, documento));
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Documento subirDocumentoDeEntrega(MultipartFile archivo, CronogramaEntregaParcialSolicitud entrega) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Los documentos de la entrega no pueden estar vacíos");
        }
        Documento documento = new Documento();
        documento.setTipoDocumento(Documento.TipoDocumento.RESPUESTA_ENTIDAD);
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        documento.setCreadoPor(autorizacion.obtenerUsuarioActual());
        documento.setEntregaParcial(entrega);
        return guardarArchivo(archivo, documento);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Documento subirActoTtaip(MultipartFile archivo, Documento documento, String nombre) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("El archivo documental es obligatorio");
        }
        documento.setEstado(Documento.EstadoDocumento.ACTIVO);
        documento.setCreadoPor(autorizacion.obtenerUsuarioActual());
        return guardarArchivo(archivo, documento, nombre);
    }

    private Documento guardarArchivo(MultipartFile file, Documento documento) {
        return guardarArchivo(file, documento, null);
    }

    private Documento guardarArchivo(MultipartFile file, Documento documento, String nombre) {
        StorageProvider provider = providerFor(activeProvider);
        StorageUploadResult upload;
        AtomicBoolean cleanupAttempted;
        try (InputStream content = file.getInputStream()) {
            upload = provider.upload(new StorageUploadRequest(
                    nombre != null ? nombre : file.getOriginalFilename(),
                    file.getContentType(),
                    file.getSize(),
                    content));
            // Register before closing the stream: closing may also fail after a successful upload.
            cleanupAttempted = compensarEnRollback(provider, upload.metadata().storageKey());
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
            return documentoRepository.save(documento);
        } catch (RuntimeException exception) {
            if (cleanupAttempted.compareAndSet(false, true)) {
                try {
                    provider.delete(metadata.storageKey());
                } catch (RuntimeException cleanupException) {
                    exception.addSuppressed(cleanupException);
                }
            }
            throw exception;
        }
    }

    @Transactional
    public DocumentoMetadataDTO clonar(Long documentoId, DocumentoUploadRequest request) {
        validarCargaClonacion(request);
        validarEstadoEntidadAsociada(request);

        Documento original = buscarActivo(documentoId);
        verificarAcceso(original);

        Documento copia = new Documento();
        copia.setTipoDocumento(request.tipoDocumento());
        copia.setEstado(Documento.EstadoDocumento.ACTIVO);
        copia.setCreadoPor(autorizacion.obtenerUsuarioActual());
        asociarRecurso(copia, request);

        StorageProvider provider = providerFor(original.getStorageProvider());
        StorageDownloadResult download = provider.download(original.getStorageKey(), original.getContentType());
        StorageUploadResult upload;
        AtomicBoolean cleanupAttempted;
        try (InputStream content = download.content()) {
            upload = provider.upload(new StorageUploadRequest(
                    original.getNombreOriginal(),
                    original.getContentType(),
                    original.getSizeBytes(),
                    content));
            // A later receipt/act failure must compensate this copy, never its source.
            // Register before closing: close itself can fail after upload succeeded.
            cleanupAttempted = compensarEnRollback(provider, upload.metadata().storageKey());
        } catch (IOException exception) {
            throw new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "Error al clonar el archivo físico en el almacenamiento",
                    exception);
        }

        StorageObjectMetadata metadata = upload.metadata();
        copia.setNombreOriginal(metadata.originalFilename());
        copia.setContentType(metadata.contentType());
        copia.setSizeBytes(metadata.sizeBytes());
        copia.setHashSha256(metadata.hashSha256());
        copia.setStorageProvider(metadata.provider());
        copia.setStorageBucket(metadata.bucket());
        copia.setStorageKey(metadata.storageKey());

        try {
            return DocumentoMetadataDTO.from(documentoRepository.save(copia));
        } catch (RuntimeException exception) {
            if (cleanupAttempted.compareAndSet(false, true)) {
                try {
                    provider.delete(metadata.storageKey());
                } catch (RuntimeException cleanupException) {
                    exception.addSuppressed(cleanupException);
                }
            }
            throw exception;
        }
    }

    private static final Set<Documento.TipoDocumento> DOCUMENTOS_DEL_ADMINISTRADO = EnumSet.of(
            Documento.TipoDocumento.SOLICITUD_ORIGINAL,
            Documento.TipoDocumento.DOCUMENTO_ADJUNTO,
            Documento.TipoDocumento.SUBSANACION,
            Documento.TipoDocumento.OTRO);

    /**
     * El expediente de destino recibe los archivos que el administrado presentó ante la entidad de origen.
     * Conservan el expediente y la entidad de esa gestión para no leerse como una precisión nueva.
     */
    @Transactional
    public void copiarDocumentosDelAdministrado(Solicitud origen, Solicitud destino) {
        if (origen == null || destino == null || origen.getId() == null || destino.getId() == null) {
            return;
        }
        String expediente = origen.getExpediente();
        String entidad = origen.getEntidad() != null ? origen.getEntidad().getNombre() : null;
        List<Documento> fuentes = documentoRepository.findBySolicitud_IdSolicitudAndEstadoOrderByFechaCreacionDesc(
                origen.getId(), Documento.EstadoDocumento.ACTIVO);
        for (Documento fuente : fuentes) {
            if (!esDocumentoDelAdministrado(fuente)) {
                continue;
            }
            Documento copia = new Documento();
            copia.setNombreOriginal(fuente.getNombreOriginal());
            copia.setStorageKey(fuente.getStorageKey());
            copia.setContentType(fuente.getContentType());
            copia.setSizeBytes(fuente.getSizeBytes());
            copia.setHashSha256(fuente.getHashSha256());
            copia.setStorageProvider(fuente.getStorageProvider() != null
                    ? fuente.getStorageProvider() : StorageProviderType.LOCAL);
            copia.setStorageBucket(fuente.getStorageBucket());
            copia.setTipoDocumento(fuente.getTipoDocumento());
            copia.setEstado(Documento.EstadoDocumento.ACTIVO);
            copia.setFechaCreacion(fuente.getFechaCreacion());
            copia.setCreadoPor(fuente.getCreadoPor());
            copia.setSolicitud(destino);
            copia.setExpedienteOrigen(expediente);
            copia.setEntidadOrigen(entidad);
            documentoRepository.save(copia);
        }
    }

    private static boolean esDocumentoDelAdministrado(Documento documento) {
        return documento.getNombreOriginal() != null
                && !documento.getNombreOriginal().isBlank()
                && documento.getStorageKey() != null
                && !documento.getStorageKey().isBlank()
                && documento.getContentType() != null
                && !documento.getContentType().isBlank()
                && documento.getTipoDocumento() != null
                && DOCUMENTOS_DEL_ADMINISTRADO.contains(documento.getTipoDocumento())
                && !documento.isBorradorTtaip()
                && !documento.isSoloInstitucionalTtaip()
                && documento.getRespuesta() == null
                && documento.getApelacion() == null
                && documento.getResolucion() == null
                && documento.getExpedienteTtaip() == null
                && documento.getCedulaNotificacion() == null
                && documento.getEntregaParcial() == null;
    }

    @Transactional(readOnly = true)
    public DocumentoMetadataDTO obtenerMetadata(Long documentoId) {
        Documento documento = buscarActivo(documentoId);
        verificarAcceso(documento);
        return DocumentoMetadataDTO.from(documento);
    }

    /** Confirms an authorized document still exists before acknowledging a precision. */
    @Transactional(readOnly = true)
    public DocumentoMetadataDTO obtenerMetadataDisponible(Long documentoId) {
        Documento documento = buscarActivo(documentoId);
        verificarAcceso(documento);
        if (!providerFor(documento.getStorageProvider()).exists(documento.getStorageKey())) {
            throw new StorageException(StorageException.Reason.IO_ERROR,
                    "No se pudo verificar el archivo recibido; vuelva a consultar la recepción");
        }
        return DocumentoMetadataDTO.from(documento);
    }

    private AtomicBoolean compensarEnRollback(StorageProvider provider, String storageKey) {
        AtomicBoolean cleanupAttempted = new AtomicBoolean();
        if (TransactionSynchronizationManager.isActualTransactionActive()
                && TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    // Unknown outcomes must be reconciled; deleting could destroy a committed upload.
                    if (status == STATUS_ROLLED_BACK && cleanupAttempted.compareAndSet(false, true)) {
                        try {
                            provider.delete(storageKey);
                        } catch (RuntimeException exception) {
                            LOGGER.error("No fue posible compensar un archivo tras rollback documental", exception);
                        }
                    }
                }
            });
        }
        return cleanupAttempted;
    }

    @Transactional(readOnly = true)
    public List<DocumentoMetadataDTO> listarPorRelacion(DocumentoRelacionRequest request) {
        validarRelacion(request);
        List<Documento> documentos;

        if (request.solicitudId() != null) {
            autorizacion.verificarSolicitudAccesible(request.solicitudId());
            documentos = documentoRepository
                    .findBySolicitud_IdSolicitudAndEstadoOrderByFechaCreacionDesc(
                            request.solicitudId(),
                            Documento.EstadoDocumento.ACTIVO);
        } else if (request.respuestaId() != null) {
            autorizacion.verificarRespuestaAccesible(request.respuestaId());
            documentos = documentoRepository
                    .findByRespuesta_IdRespuestaAndEstadoOrderByFechaCreacionDesc(
                            request.respuestaId(),
                            Documento.EstadoDocumento.ACTIVO);
        } else if (request.apelacionId() != null) {
            autorizacion.verificarApelacionAccesible(request.apelacionId());
            documentos = documentoRepository
                    .findByApelacion_IdApelacionAndEstadoOrderByFechaCreacionDesc(
                            request.apelacionId(),
                            Documento.EstadoDocumento.ACTIVO);
        } else if (request.expedienteTtaipId() != null) {
            autorizacion.verificarExpedienteTtaipAccesible(request.expedienteTtaipId());
            documentos = documentoRepository
                    .findByExpedienteTtaip_IdExpedienteTtaipAndEstadoOrderByFechaCreacionDesc(
                            request.expedienteTtaipId(),
                            Documento.EstadoDocumento.ACTIVO);
        } else if (request.resolucionId() != null) {
            Resolucion resolucion = buscarResolucion(request.resolucionId());
            verificarResolucionNotificable(resolucion);
            autorizacion.verificarApelacionAccesible(resolucion.getApelacion());
            documentos = documentoRepository
                    .findByResolucion_IdResolucionAndEstadoOrderByFechaCreacionDesc(
                            request.resolucionId(),
                            Documento.EstadoDocumento.ACTIVO);
        } else {
            CedulaNotificacion cedula = buscarCedula(request.cedulaNotificacionId());
            verificarDestinatario(cedula);
            autorizacion.verificarApelacionAccesible(cedula.getResolucion().getApelacion());
            documentos = documentoRepository
                    .findByCedulaNotificacion_IdCedulaAndEstadoOrderByFechaCreacionDesc(
                            request.cedulaNotificacionId(),
                            Documento.EstadoDocumento.ACTIVO);
        }

        return documentos.stream()
                .filter(doc -> !doc.isSoloInstitucionalTtaip() || autorizacion.esAdministradorOTtaip() || autorizacion.esFuncionario())
                .map(DocumentoMetadataDTO::from).toList();
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
        if (documento.getEntregaParcial() != null) {
            throw new ConflictoEstadoException("El documento pertenece a una entrega parcial registrada");
        }
        if (documento.isBorradorTtaip() || documento.isSoloInstitucionalTtaip()
                || (documento.getCedulaNotificacion() != null && documento.getCedulaNotificacion().getTipoActo() != null)
                || (documento.getResolucion() != null && documento.getResolucion().isActosDocumentales())) {
            throw new ConflictoEstadoException("El archivo pertenece a una actuación documental TTAIP");
        }
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
        validarTipoCargaGeneral(request.tipoDocumento());
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
        if (request.respuestaId() != null) {
            Respuesta respuesta = buscarRespuesta(request.respuestaId());
            autorizacion.verificarSolicitudInstitucional(respuesta.getSolicitud().getIdSolicitud());
            documento.setRespuesta(respuesta);
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
            CedulaNotificacion cedula = buscarCedula(request.cedulaNotificacionId());
            if (cedula.getTipoActo() != null) throw new ConflictoEstadoException("Use los actos documentales de la notificación");
            documento.setCedulaNotificacion(cedula);
        }
    }

    private void verificarAcceso(Documento documento) {
        if (documento.isBorradorTtaip()) {
            autorizacion.verificarTtaipOAdministrador();
            return;
        }
        if (documento.isSoloInstitucionalTtaip()) {
            autorizacion.verificarExpedienteTtaipInstitucional(documento.getExpedienteTtaip().getId());
            return;
        }
        if (documento.getEntregaParcial() != null) {
            autorizacion.verificarSolicitudAccesible(documento.getEntregaParcial().getAmpliacion().getSolicitud());
            return;
        }
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
            verificarResolucionNotificable(documento.getResolucion());
            autorizacion.verificarApelacionAccesible(documento.getResolucion().getApelacion());
            return;
        }
        if (documento.getCedulaNotificacion() != null) {
            verificarDestinatario(documento.getCedulaNotificacion());
            autorizacion.verificarApelacionAccesible(
                    documento.getCedulaNotificacion().getResolucion().getApelacion());
            return;
        }
        throw new IllegalStateException("El documento no tiene una relación de negocio válida");
    }

    private void verificarResolucionNotificable(Resolucion resolucion) {
        if (resolucion.isActosDocumentales() && resolucion.getDecision() == Resolucion.DecisionResolucion.INADMISIBLE
                && autorizacion.esFuncionario()) {
            throw new org.springframework.security.access.AccessDeniedException("La inadmisibilidad se notifica al recurrente");
        }
    }

    private void verificarDestinatario(CedulaNotificacion cedula) {
        if (cedula.getTipoActo() != null && !autorizacion.esAdministradorOTtaip()
                && ("BORRADOR_REPROCESO".equals(cedula.getEstado())
                || autorizacion.esFuncionario() != (cedula.getDestinatario() == CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA))) {
            throw new org.springframework.security.access.AccessDeniedException("El documento corresponde al otro destinatario");
        }
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

    private Respuesta buscarRespuesta(Long id) {
        return respuestaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Respuesta no encontrada con ID: " + id));
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

    private void validarRelacion(DocumentoRelacionRequest request) {
        if (request == null || request.relationCount() != 1) {
            throw new IllegalArgumentException(
                    "Debe indicar exactamente una relación documental para la consulta");
        }
    }

    private void validarEstadoEntidadAsociada(DocumentoUploadRequest request) {
        if (request.solicitudId() != null) {
            Solicitud solicitud = buscarSolicitud(request.solicitudId());
            if (solicitud.getEstado() == Solicitud.EstadoSolicitud.RESPONDIDA || solicitud.getEstado() == Solicitud.EstadoSolicitud.VENCIDA) {
                throw new ConflictoEstadoException("No se pueden adjuntar documentos a una solicitud en estado " + solicitud.getEstado());
            }
        }
        if (request.apelacionId() != null) {
            Apelacion apelacion = buscarApelacion(request.apelacionId());
            if (apelacion.isResuelta() || (apelacion.getEstado() != null && apelacion.getEstado().name().startsWith("RESUELTO"))) {
                throw new ConflictoEstadoException("No se pueden adjuntar documentos a una apelación ya resuelta/cerrada.");
            }
        }
        if (request.expedienteTtaipId() != null) {
            ExpedienteTtaip expediente = buscarExpediente(request.expedienteTtaipId());
            Apelacion apelacion = expediente.getApelacion();
            if (apelacion != null && (apelacion.isResuelta() || (apelacion.getEstado() != null && apelacion.getEstado().name().startsWith("RESUELTO")))) {
                throw new ConflictoEstadoException("No se pueden adjuntar documentos a una apelación ya resuelta/cerrada.");
            }
        }
    }

    private void validarTipoCargaGeneral(Documento.TipoDocumento tipo) {
        if (List.of(Documento.TipoDocumento.CARGO_NOTIFICACION_TTAIP, Documento.TipoDocumento.ACUSE_NOTIFICACION_TTAIP,
                Documento.TipoDocumento.CARTA_NOTIFICACION_TTAIP, Documento.TipoDocumento.OFICIO_CARTA_TTAIP)
                .contains(tipo)) {
            throw new IllegalArgumentException("Use la operación de actos documentales TTAIP");
        }
    }

    private void validarCargaClonacion(DocumentoUploadRequest request) {
        if (request == null || request.tipoDocumento() == null) {
            throw new IllegalArgumentException("El tipo de documento es obligatorio");
        }
        validarTipoCargaGeneral(request.tipoDocumento());
        if (request.relationCount() != 1) {
            throw new IllegalArgumentException(
                    "El documento debe asociarse exactamente a un recurso de negocio");
        }
    }
}
