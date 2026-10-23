package pe.gob.saip.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import jakarta.persistence.EntityManager;
import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.RespuestaRepository;
import pe.gob.saip.backend.repository.RespuestaSaipRecepcionRepository;
import pe.gob.saip.backend.storage.StorageException;

/** Coordinates the existing response commands and compensated document uploads in one DB transaction. */
@Service
public class RespuestaSaipRecepcionService {
    private final SolicitudService solicitudes;
    private final RespuestaService respuestas;
    private final RespuestaRepository respuestaRepository;
    private final RespuestaSaipRecepcionRepository recepciones;
    private final DocumentoService documentos;
    private final AutorizacionRecursosService autorizacion;
    private final EntityManager em;
    private final long maxFileSize;

    public RespuestaSaipRecepcionService(SolicitudService solicitudes, RespuestaService respuestas,
            RespuestaRepository respuestaRepository, RespuestaSaipRecepcionRepository recepciones,
            DocumentoService documentos, AutorizacionRecursosService autorizacion,
            EntityManager em, StorageProperties properties) {
        this.solicitudes = solicitudes;
        this.respuestas = respuestas;
        this.respuestaRepository = respuestaRepository;
        this.recepciones = recepciones;
        this.documentos = documentos;
        this.autorizacion = autorizacion;
        this.em = em;
        this.maxFileSize = properties.getMaxFileSize();
    }

    @Transactional
    public RespuestaSaipRecepcionDTO registrar(Long solicitudId, RegistrarRespuestaSaipRequest request) {
        Solicitud solicitud = solicitudes.bloquearSolicitudInstitucional(solicitudId);
        Usuario actor = autorizacion.obtenerUsuarioActual();
        Long funcionarioId = request.funcionarioId();
        if (funcionarioId == null && actor.getTipoUsuario() == Usuario.TipoUsuario.FUNCIONARIO) funcionarioId = actor.getIdUsuario();
        if (funcionarioId == null) throw new IllegalArgumentException("Indique el funcionario autorizado para registrar la respuesta");
        autorizacion.verificarFuncionarioPuedeActuar(funcionarioId);
        List<MultipartFile> archivos = request.archivos() == null ? List.of() : List.copyOf(request.archivos());
        String huella = huella(solicitudId, actor.getIdUsuario(), funcionarioId, request, archivos);
        String clave = request.claveOperacion().toString();
        var anterior = recepciones.findBySolicitud_IdSolicitud(solicitudId);
        if (anterior.isPresent()) {
            RespuestaSaipRecepcion recibida = anterior.get();
            verificarActor(recibida, actor);
            if (!clave.equals(recibida.getClaveOperacion()) || !huella.equals(recibida.getHuellaSolicitud())) {
                throw new ConflictoEstadoException("La solicitud ya tiene otra recepción de respuesta; compruebe el registro existente");
            }
            // Replays do not re-run transitions or append documents after later domain events.
            return toDTO(recibida);
        }
        if (recepciones.existsByCreadoPor_IdUsuarioAndClaveOperacion(actor.getIdUsuario(), clave)) {
            throw new ConflictoEstadoException("La clave de operación ya fue utilizada para otra solicitud");
        }
        CrearRespuestaRequest comando = new CrearRespuestaRequest(solicitudId, funcionarioId,
                request.tipoRespuesta(), request.contenido(), request.causalDenegatoria(),
                request.fundamentoLegal(), request.formatoEntrega(), request.plazoEntrega());
        RespuestaDTO creada = switch (request.tipoRespuesta()) {
            case "ENTREGA_TOTAL" -> respuestas.aceptarSolicitud(comando);
            case "ENTREGA_PARCIAL" -> respuestas.crearRespuesta(comando);
            case "DENEGACION_TOTAL" -> respuestas.denegarSolicitud(comando);
            default -> throw new IllegalArgumentException("Tipo de respuesta no válido");
        };
        RespuestaSaipRecepcion recibida = new RespuestaSaipRecepcion();
        recibida.setSolicitud(solicitud);
        recibida.setRespuesta(respuestaRepository.getReferenceById(creada.id()));
        recibida.setCreadoPor(actor);
        recibida.setClaveOperacion(clave);
        recibida.setHuellaSolicitud(huella);
        recibida.setFechaRecepcion(recibida.getRespuesta().getFechaRespuesta());
        for (MultipartFile archivo : archivos) {
            DocumentoMetadataDTO doc = documentos.subir(archivo, new DocumentoUploadRequest(
                    Documento.TipoDocumento.RESPUESTA_ENTIDAD, null, creada.id(), null, null, null, null));
            recibida.getDocumentoIds().add(doc.id());
        }
        // Flush includes the manifest and unique constraints. Each uploaded object already has rollback compensation.
        recepciones.saveAndFlush(recibida);
        em.refresh(recibida);
        em.refresh(recibida.getRespuesta());
        // PostgreSQL timestamps have database precision, including for documents created in this transaction.
        for (Long id : recibida.getDocumentoIds()) em.refresh(em.getReference(Documento.class, id));
        return toDTO(recibida);
    }

    @Transactional(readOnly = true)
    public RespuestaSaipRecepcionDTO obtener(Long solicitudId, UUID claveOperacion) {
        autorizacion.verificarSolicitudInstitucional(solicitudId);
        RespuestaSaipRecepcion recibida = recepciones.findBySolicitud_IdSolicitud(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("No se ha confirmado recepción para esta operación"));
        verificarActor(recibida, autorizacion.obtenerUsuarioActual());
        if (!claveOperacion.toString().equals(recibida.getClaveOperacion())) {
            throw new RecursoNoEncontradoException("No se ha confirmado recepción para esta operación");
        }
        return toDTO(recibida);
    }

    private void verificarActor(RespuestaSaipRecepcion recibida, Usuario actor) {
        if (!recibida.getCreadoPor().getIdUsuario().equals(actor.getIdUsuario())) {
            throw new AccessDeniedException("La recepción corresponde a otro actor autorizado");
        }
    }

    private RespuestaSaipRecepcionDTO toDTO(RespuestaSaipRecepcion recibida) {
        if (!recibida.getSolicitud().getId().equals(recibida.getRespuesta().getSolicitud().getId())) {
            throw new ConflictoEstadoException("La respuesta no corresponde a la recepción registrada");
        }
        List<DocumentoMetadataDTO> manifest = new ArrayList<>();
        for (Long id : recibida.getDocumentoIds()) {
            DocumentoMetadataDTO doc;
            try {
                doc = documentos.obtenerMetadataDisponible(id);
            } catch (StorageException | RecursoNoEncontradoException exception) {
                // A missing accepted file is not absence of a receipt: never invite a fresh registration.
                throw new StorageException(StorageException.Reason.IO_ERROR,
                        "La recepción existe, pero un documento no está disponible. No repita el registro", exception);
            }
            if (!recibida.getRespuesta().getId().equals(doc.respuestaId())
                    || !Documento.TipoDocumento.RESPUESTA_ENTIDAD.name().equals(doc.tipoDocumento())) {
                throw new ConflictoEstadoException("El documento no corresponde a la recepción registrada");
            }
            manifest.add(doc);
        }
        return new RespuestaSaipRecepcionDTO(recibida.getId(), recibida.getSolicitud().getId(),
                recibida.getClaveOperacion(), recibida.getFechaRecepcion(),
                RespuestaDTO.from(recibida.getRespuesta()), List.copyOf(manifest));
    }

    private String huella(Long solicitudId, Long actorId, Long funcionarioId,
                          RegistrarRespuestaSaipRequest request, List<MultipartFile> archivos) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (String campo : new String[]{"saip:respuesta:v1", solicitudId.toString(), actorId.toString(),
                    funcionarioId.toString(), request.tipoRespuesta(), request.contenido(), request.causalDenegatoria(),
                    request.fundamentoLegal(), request.formatoEntrega(),
                    request.plazoEntrega() == null ? null : request.plazoEntrega().toString(), String.valueOf(archivos.size())}) {
                campo(digest, campo);
            }
            for (MultipartFile archivo : archivos) {
                if (archivo == null || archivo.isEmpty() || archivo.getSize() > maxFileSize) {
                    throw new IllegalArgumentException("Adjunte archivos no vacíos dentro del tamaño permitido");
                }
                campo(digest, archivo.getOriginalFilename()); campo(digest, archivo.getContentType());
                campo(digest, String.valueOf(archivo.getSize()));
                try (InputStream in = archivo.getInputStream()) {
                    byte[] buffer = new byte[8192]; int read; long total = 0;
                    while ((read = in.read(buffer)) != -1) {
                        total += read;
                        if (total > maxFileSize) throw new IllegalArgumentException("El archivo supera el tamaño permitido");
                        digest.update(buffer, 0, read);
                    }
                    if (total != archivo.getSize()) throw new IllegalArgumentException("Tamaño del archivo inconsistente");
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException exception) {
            throw new StorageException(StorageException.Reason.IO_ERROR, "No fue posible leer los archivos recibidos", exception);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no disponible", exception);
        }
    }

    private void campo(MessageDigest digest, String valor) {
        byte[] bytes = valor == null ? new byte[0] : valor.getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(4).putInt(valor == null ? -1 : bytes.length).array());
        digest.update(bytes);
    }
}
