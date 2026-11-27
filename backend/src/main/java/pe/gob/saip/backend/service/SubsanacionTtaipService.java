package pe.gob.saip.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import pe.gob.saip.backend.config.StorageProperties;
import pe.gob.saip.backend.exception.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.storage.StorageException;
import pe.gob.saip.backend.util.DiasHabilesUtil;

/** Coordinates one committed presentation and all selected uploads per concrete TTAIP requirement. */
@Service
public class SubsanacionTtaipService {
    private final ApelacionRepository apelaciones;
    private final ResolucionRepository resoluciones;
    private final SubsanacionTtaipRecepcionRepository recepciones;
    private final DocumentoRepository documentos;
    private final HistorialTtaipRepository historial;
    private final DocumentoService documentoService;
    private final ExpedienteTtaipService expedientes;
    private final AutorizacionRecursosService autorizacion;
    private final EntityManager entityManager;
    private final long maxFileSize;

    public SubsanacionTtaipService(ApelacionRepository apelaciones, ResolucionRepository resoluciones,
            SubsanacionTtaipRecepcionRepository recepciones, DocumentoRepository documentos,
            HistorialTtaipRepository historial, DocumentoService documentoService,
            ExpedienteTtaipService expedientes, AutorizacionRecursosService autorizacion,
            EntityManager entityManager, StorageProperties storage) {
        this.apelaciones = apelaciones; this.resoluciones = resoluciones; this.recepciones = recepciones;
        this.documentos = documentos; this.historial = historial; this.documentoService = documentoService;
        this.expedientes = expedientes; this.autorizacion = autorizacion; this.entityManager = entityManager;
        this.maxFileSize = storage.getMaxFileSize();
    }

    @Transactional(readOnly = true)
    public RequerimientoSubsanacionTtaipDTO requerimientoActual(Long apelacionId) {
        autorizacion.verificarApelacionCiudadanaOAdministrador(apelacionId);
        Apelacion ap = buscar(apelacionId);
        Resolucion resolucion = actual(apelacionId);
        PlazoSubsanacionTtaipDTO plazo = PlazoSubsanacionTtaipDTO.from(resolucion);
        LocalDate limite = plazo.fechaLimite();
        return new RequerimientoSubsanacionTtaipDTO(apelacionId, resolucion.getId(),
                resolucion.getNumeroResolucion(), resolucion.getObservaciones(), plazo.fechaEficacia()==null ? null : plazo.fechaEficacia().toLocalDate(), limite,
                plazo.diasHabiles(), plazo.diasHabilesRestantes(),
                ap.getEstado() == Apelacion.EstadoApelacion.EN_SUBSANACION
                    && resolucion.getDecision() == Resolucion.DecisionResolucion.INADMISIBLE
                    && (limite == null || !LocalDate.now().isAfter(limite)), false, plazo);
    }

    @Transactional
    public SubsanacionTtaipRecepcionDTO registrar(Long apelacionId, Long requerimientoId,
                                                RegistrarSubsanacionTtaipRequest request) {
        validar(request);
        autorizacion.verificarApelacionCiudadanaOAdministrador(apelacionId);
        Apelacion ap = bloquear(apelacionId);
        Resolucion requerimiento = resolver(apelacionId, requerimientoId);
        String clave = request.claveOperacion().toString();
        String huella = huella(request);
        var anterior = recepciones.findByRequerimiento_IdResolucion(requerimientoId);
        if (anterior.isPresent()) {
            SubsanacionTtaipRecepcion recibida = anterior.get();
            if (!clave.equals(recibida.getClaveOperacion()) || !huella.equals(recibida.getHuellaSolicitud())) {
                throw new ConflictoEstadoException("El requerimiento ya tiene una presentación recibida con otra operación o contenido");
            }
            return dto(recibida);
        }
        if (recepciones.findByClaveOperacion(clave).isPresent()) {
            throw new ConflictoEstadoException("La clave de operación ya se utilizó en otra recepción");
        }
        if (!actual(apelacionId).getId().equals(requerimientoId)) {
            throw new ConflictoEstadoException("El requerimiento indicado ya no es el vigente");
        }
        if (ap.getEstado() != Apelacion.EstadoApelacion.EN_SUBSANACION
                || requerimiento.getTipoResolucion() != Resolucion.TipoResolucion.PRIMERA_CALIFICACION
                || requerimiento.getDecision() != Resolucion.DecisionResolucion.INADMISIBLE) {
            throw new ConflictoEstadoException("La apelación no admite subsanación de este requerimiento");
        }
        LocalDate limite = PlazoSubsanacionTtaipDTO.from(requerimiento).fechaLimite();
        if (limite != null && LocalDate.now().isAfter(limite)) {
            // Reject the presentation; closure requires its own recorded resolution and grounds.
            throw new PlazoSubsanacionTtaipVencidoException();
        }
        Usuario actor = autorizacion.obtenerUsuarioActual();
        SubsanacionTtaipRecepcion recibida = new SubsanacionTtaipRecepcion();
        recibida.setRequerimiento(requerimiento); recibida.setCreadoPor(actor);
        recibida.setClaveOperacion(clave); recibida.setHuellaSolicitud(huella);
        recibida.setFechaRecepcion(LocalDateTime.now());
        recibida.setFundamentos(request.fundamentosAdicionales().trim());
        for (MultipartFile archivo : archivos(request)) {
            // DocumentoService registers rollback compensation for each successful physical upload.
            DocumentoMetadataDTO doc = documentoService.subir(archivo, new DocumentoUploadRequest(
                    Documento.TipoDocumento.SUBSANACION, null, null, apelacionId, null, null, null));
            recibida.getDocumentos().add(documentos.getReferenceById(doc.id()));
        }
        ap.setFundamentos((ap.getFundamentos() == null ? "" : ap.getFundamentos())
                + "\n\n--- SUBSANACIÓN ---\n" + recibida.getFundamentos());
        ap.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2);
        ExpedienteTtaip expediente = expedientes.obtenerOCrearParaApelacion(ap);
        HistorialTtaip evento = new HistorialTtaip();
        evento.setExpediente(expediente); evento.setTipoEvento(HistorialTtaip.TipoEvento.SUBSANACION);
        evento.setDescripcion("Subsanación recibida para requerimiento " + requerimiento.getId());
        evento.setEstadoAnterior(Apelacion.EstadoApelacion.EN_SUBSANACION.name());
        evento.setEstadoNuevo(Apelacion.EstadoApelacion.EN_CALIFICACION_2.name());
        evento.setActor("saip:user:v1:" + actor.getIdUsuario()); evento.setReferencia(clave);
        historial.save(evento);
        recepciones.saveAndFlush(recibida);
        entityManager.refresh(recibida);
        for (Documento doc : recibida.getDocumentos()) entityManager.refresh(doc);
        return dto(recibida);
    }

    /** Existing Android/JSON contract: text-only presentation, server-generated stable retry key. */
    @Transactional
    public ApelacionDTO registrarLegacy(Long apelacionId, String fundamentos) {
        autorizacion.verificarApelacionCiudadanaOAdministrador(apelacionId);
        bloquear(apelacionId);
        Long requerimientoId = actual(apelacionId).getId();
        String texto = fundamentos == null ? "" : fundamentos.trim();
        UUID clave = UUID.nameUUIDFromBytes(("ttaip-legacy:v1:" + apelacionId + ":" + requerimientoId + ":" + texto)
                .getBytes(StandardCharsets.UTF_8));
        registrar(apelacionId, requerimientoId, new RegistrarSubsanacionTtaipRequest(clave, texto, List.of()));
        return ApelacionDTO.from(buscar(apelacionId));
    }

    @Transactional(readOnly = true)
    public SubsanacionTtaipRecepcionDTO consultar(Long apelacionId, Long requerimientoId, UUID clave) {
        autorizacion.verificarApelacionCiudadanaOAdministrador(apelacionId);
        resolver(apelacionId, requerimientoId);
        SubsanacionTtaipRecepcion recibida = recepciones.findByRequerimiento_IdResolucion(requerimientoId)
                .filter(r -> r.getClaveOperacion().equals(clave.toString()))
                .orElseThrow(() -> new RecursoNoEncontradoException("No se ha confirmado la recepción de esta operación"));
        return dto(recibida);
    }

    private SubsanacionTtaipRecepcionDTO dto(SubsanacionTtaipRecepcion recibida) {
        Apelacion ap = recibida.getRequerimiento().getApelacion();
        List<DocumentoMetadataDTO> metadata = recibida.getDocumentos().stream().map(doc -> {
            if (doc.getApelacion() == null || !ap.getId().equals(doc.getApelacion().getId())) {
                throw new ConflictoEstadoException("Un documento de la recepción no corresponde al recurso");
            }
            try {
                return documentoService.obtenerMetadataDisponible(doc.getId());
            } catch (RecursoNoEncontradoException e) {
                // A withdrawn document does not mean the committed operation is absent.
                throw new StorageException(StorageException.Reason.IO_ERROR,
                        "La recepción existe pero no se pudo recuperar uno de sus archivos", e);
            }
        }).toList();
        return new SubsanacionTtaipRecepcionDTO(recibida.getId(), ap.getId(), recibida.getRequerimiento().getId(),
                ap.getExpediente(), recibida.getClaveOperacion(), recibida.getFechaRecepcion(),
                recibida.getFundamentos(), "RECIBIDA", metadata);
    }

    /** Reports expired requirements; the scheduler cannot invent a closing resolution. */
    @Transactional
    public int procesarVencidas() {
        int count=0;
        for (Apelacion candidata : apelaciones.findByEstadoOrderByFechaApelacionDesc(Apelacion.EstadoApelacion.EN_SUBSANACION)) {
            Apelacion ap=bloquear(candidata.getId());
            if (ap.getEstado()!=Apelacion.EstadoApelacion.EN_SUBSANACION) continue;
            PlazoSubsanacionTtaipDTO plazo=PlazoSubsanacionTtaipDTO.from(ap);
            if (plazo!=null && "VENCIDO".equals(plazo.estado())) {
                count++;
            }
        }
        return count;
    }

    private Apelacion buscar(Long id) {
        return apelaciones.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada"));
    }
    private Apelacion bloquear(Long id) {
        Apelacion ap = apelaciones.findByIdForUpdate(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada"));
        // Authorization may have already loaded this entity before a competing transaction committed.
        entityManager.refresh(ap, LockModeType.PESSIMISTIC_WRITE);
        return ap;
    }
    private Resolucion resolver(Long apelacionId, Long requerimientoId) {
        Resolucion r = resoluciones.findById(requerimientoId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Requerimiento no encontrado"));
        if (!apelacionId.equals(r.getApelacion().getId())) {
            throw new RecursoNoEncontradoException("El requerimiento no pertenece a la apelación indicada");
        }
        return r;
    }
    private Resolucion actual(Long id) {
        return resoluciones.findByApelacion_Id(id).stream()
                .filter(r -> r.getTipoResolucion() == Resolucion.TipoResolucion.PRIMERA_CALIFICACION)
                .max(Comparator.comparing(Resolucion::getFechaResolucion,
                        Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(Resolucion::getId))
                .orElseThrow(() -> new RecursoNoEncontradoException("No hay una calificación identificable para subsanar"));
    }
    private List<MultipartFile> archivos(RegistrarSubsanacionTtaipRequest r) {
        return r.archivos() == null ? List.of() : r.archivos();
    }
    private void validar(RegistrarSubsanacionTtaipRequest r) {
        if (r == null || r.claveOperacion() == null || r.fundamentosAdicionales() == null
                || r.fundamentosAdicionales().isBlank()) {
            throw new IllegalArgumentException("Indique clave de operación y fundamentos");
        }
        long total = 0;
        for (MultipartFile archivo : archivos(r)) {
            if (archivo == null || archivo.isEmpty() || archivo.getSize() > maxFileSize) {
                throw new IllegalArgumentException("Adjunte archivos no vacíos dentro del tamaño permitido");
            }
            total += archivo.getSize();
            if (total > maxFileSize) throw new IllegalArgumentException("Los adjuntos superan el tamaño total permitido");
        }
    }
    private String huella(RegistrarSubsanacionTtaipRequest r) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            campo(digest, r.fundamentosAdicionales().trim());
            campo(digest, Integer.toString(archivos(r).size()));
            for (MultipartFile archivo : archivos(r)) {
                campo(digest, archivo.getOriginalFilename()); campo(digest, archivo.getContentType());
                MessageDigest contenido = MessageDigest.getInstance("SHA-256");
                try (InputStream input = archivo.getInputStream()) {
                    byte[] buffer = new byte[8192]; long total = 0; int n;
                    while ((n = input.read(buffer)) != -1) {
                        total += n;
                        if (total > maxFileSize) throw new IllegalArgumentException("El archivo supera el tamaño permitido");
                        contenido.update(buffer, 0, n);
                    }
                    campo(digest, Long.toString(total));
                }
                campo(digest, HexFormat.of().formatHex(contenido.digest()));
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException e) {
            throw new StorageException(StorageException.Reason.IO_ERROR, "No se pudo leer un adjunto de subsanación", e);
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 no disponible", e); }
    }
    private void campo(MessageDigest digest, String value) {
        byte[] bytes = (value == null ? "" : value).getBytes(StandardCharsets.UTF_8);
        digest.update(ByteBuffer.allocate(Integer.BYTES).putInt(bytes.length).array()); digest.update(bytes);
    }
}
