package pe.gob.saip.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import jakarta.persistence.EntityManager;

import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.DocumentoUploadRequest;
import pe.gob.saip.backend.model.dto.PrecisionSaipRecepcionDTO;
import pe.gob.saip.backend.model.dto.RegistrarPrecisionSaipRequest;
import pe.gob.saip.backend.model.dto.SubsanarSolicitudRequest;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.model.entity.ObservacionSolicitud;
import pe.gob.saip.backend.model.entity.PrecisionSaipRecepcion;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.DocumentoRepository;
import pe.gob.saip.backend.repository.ObservacionSolicitudRepository;
import pe.gob.saip.backend.repository.PrecisionSaipRecepcionRepository;
import pe.gob.saip.backend.storage.StorageException;

/** Receives precision bytes and commits the document, transition and receipt together. */
@Service
public class PrecisionSaipService {
    private final ObservacionSolicitudRepository observaciones;
    private final PrecisionSaipRecepcionRepository recepciones;
    private final DocumentoRepository documentos;
    private final DocumentoService documentoService;
    private final SolicitudService solicitudService;
    private final AutorizacionRecursosService autorizacion;
    private final EntityManager entityManager;
    private final long maxFileSize;

    public PrecisionSaipService(ObservacionSolicitudRepository observaciones,
                               PrecisionSaipRecepcionRepository recepciones,
                               DocumentoRepository documentos,
                               DocumentoService documentoService,
                               SolicitudService solicitudService,
                               AutorizacionRecursosService autorizacion,
                               EntityManager entityManager,
                               StorageProperties storageProperties) {
        this.observaciones = observaciones;
        this.recepciones = recepciones;
        this.documentos = documentos;
        this.documentoService = documentoService;
        this.solicitudService = solicitudService;
        this.autorizacion = autorizacion;
        this.entityManager = entityManager;
        this.maxFileSize = storageProperties.getMaxFileSize();
    }

    /** Replays an identical accepted operation, or atomically receives a new precision. */
    @Transactional
    public PrecisionSaipRecepcionDTO registrar(Long solicitudId, Long observacionId,
                                              RegistrarPrecisionSaipRequest request) {
        validarRequest(request);
        autorizacion.verificarSolicitudCiudadana(solicitudId);
        solicitudService.bloquearSolicitud(solicitudId);
        ObservacionSolicitud observacion = observaciones.findByIdForUpdate(observacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Observación SAIP no encontrada"));
        verificarRelacion(solicitudId, observacion);

        String clave = request.claveOperacion().toString();
        String huella = calcularHuella(request);
        var anterior = recepciones.findByObservacion_IdObservacion(observacionId);
        if (anterior.isPresent()) {
            PrecisionSaipRecepcion recibida = anterior.get();
            if (!clave.equals(recibida.getClaveOperacion()) || !huella.equals(recibida.getHuellaSolicitud())) {
                throw new ConflictoEstadoException("La observación ya tiene una precisión recibida; no vuelva a presentarla");
            }
            // A replay must work even after the original deadline has elapsed.
            return toDTO(recibida);
        }

        Usuario actor = autorizacion.obtenerUsuarioActual();
        String comentario = request.comentario().trim();
        // Preserve the existing deadline and transition rules. Failure later rolls this back.
        ObservacionSolicitud subsanada = solicitudService.subsanarSolicitudDocumental(solicitudId, observacionId,
                new SubsanarSolicitudRequest(comentario, request.archivo().getOriginalFilename(), null, actor.getEmail()));
        DocumentoMetadataDTO documento = documentoService.subir(request.archivo(),
                new DocumentoUploadRequest(Documento.TipoDocumento.SUBSANACION,
                        solicitudId, null, null, null, null, null));
        subsanada.setDocumentoSubsanacionNombre(documento.nombreOriginal());
        subsanada.setDocumentoSubsanacionRuta("/api/documentos/" + documento.id() + "/download");

        PrecisionSaipRecepcion recibida = new PrecisionSaipRecepcion();
        recibida.setObservacion(subsanada);
        recibida.setDocumento(documentos.getReferenceById(documento.id()));
        recibida.setCreadoPor(actor);
        recibida.setClaveOperacion(clave);
        recibida.setHuellaSolicitud(huella);
        recibida.setFechaRecepcion(subsanada.getFechaSubsanacion());
        recibida.setComentario(comentario);
        // Flush also detects relational/unique failures before returning an acknowledgement.
        recepciones.saveAndFlush(recibida);
        // Return database timestamps, including its precision, so a replay returns the same receipt.
        entityManager.refresh(recibida);
        entityManager.refresh(recibida.getDocumento());
        return toDTO(recibida);
    }

    /** Returns only a committed receipt belonging to this citizen and observation. */
    @Transactional(readOnly = true)
    public PrecisionSaipRecepcionDTO obtenerRecepcion(Long solicitudId, Long observacionId, UUID claveOperacion) {
        autorizacion.verificarSolicitudCiudadana(solicitudId);
        ObservacionSolicitud observacion = observaciones.findById(observacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Observación SAIP no encontrada"));
        verificarRelacion(solicitudId, observacion);
        PrecisionSaipRecepcion recibida = recepciones
                .findByObservacion_IdObservacionAndClaveOperacion(observacionId, claveOperacion.toString())
                .orElseThrow(() -> new RecursoNoEncontradoException("No se ha confirmado la recepción de esta operación"));
        return toDTO(recibida);
    }

    private PrecisionSaipRecepcionDTO toDTO(PrecisionSaipRecepcion recibida) {
        ObservacionSolicitud observacion = recibida.getObservacion();
        DocumentoMetadataDTO documento = documentoService.obtenerMetadataDisponible(recibida.getDocumento().getId());
        return new PrecisionSaipRecepcionDTO(observacion.getSolicitud().getId(), observacion.getId(),
                recibida.getClaveOperacion(), recibida.getFechaRecepcion(), recibida.getComentario(),
                ObservacionSolicitud.EstadoObservacion.SUBSANADA.name(), documento);
    }

    private void verificarRelacion(Long solicitudId, ObservacionSolicitud observacion) {
        if (observacion.getSolicitud() == null || !solicitudId.equals(observacion.getSolicitud().getId())) {
            throw new RecursoNoEncontradoException("La observación no pertenece a la solicitud indicada");
        }
    }

    private void validarRequest(RegistrarPrecisionSaipRequest request) {
        if (request == null || request.claveOperacion() == null || request.comentario() == null
                || request.comentario().isBlank() || request.comentario().length() > 3000) {
            throw new IllegalArgumentException("Indique la clave de operación y un comentario de hasta 3000 caracteres");
        }
        MultipartFile archivo = request.archivo();
        if (archivo == null || archivo.isEmpty() || archivo.getSize() > maxFileSize) {
            throw new IllegalArgumentException("Adjunte un archivo válido dentro del tamaño permitido");
        }
    }

    private String calcularHuella(RegistrarPrecisionSaipRequest request) {
        try (InputStream contenido = request.archivo().getInputStream()) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            actualizarCampo(digest, request.comentario().trim());
            actualizarCampo(digest, request.archivo().getOriginalFilename());
            actualizarCampo(digest, request.archivo().getContentType());
            byte[] buffer = new byte[8192];
            long size = 0;
            int read;
            while ((read = contenido.read(buffer)) != -1) {
                size += read;
                if (size > maxFileSize) {
                    throw new IllegalArgumentException("El archivo supera el tamaño permitido");
                }
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException exception) {
            throw new StorageException(StorageException.Reason.IO_ERROR,
                    "No fue posible leer el archivo de precisión", exception);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no está disponible", exception);
        }
    }

    private void actualizarCampo(MessageDigest digest, String value) {
        byte[] bytes = (value == null ? "" : value).getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(bytes.length).array());
        digest.update(bytes);
    }
}
