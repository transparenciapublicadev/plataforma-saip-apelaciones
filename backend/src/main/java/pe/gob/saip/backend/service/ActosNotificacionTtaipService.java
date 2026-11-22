package pe.gob.saip.backend.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.ValidarNotificacionManualRequest;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ActosNotificacionTtaipService {
    private final ExpedienteTtaipService expedientes;
    private final NotificacionTtaipRepository notificaciones;
    private final ReprocesoNotificacionRepository reprocesos;
    private final DocumentoRepository archivos;
    private final DocumentoService documentos;
    private final TransicionesApelacionTtaipService transiciones;
    private final AutorizacionRecursosService autorizacion;

    public enum TipoActo { CEDULA, CARTA }
    public enum TipoArchivo { FIRMADO, CARGO, ACUSE }

    public record Destino(Solicitud.CanalNotificacion medio, @Size(max = 500) String direccion, TipoActo tipo) {}
    public record Revision(@jakarta.validation.constraints.NotNull Boolean valida, LocalDateTime fechaEficacia, @NotBlank @Size(max = 1000) String observacion) {}
    public record Acto(Long id, Long resolucionId, String numeroResolucion, String etapa, String decision,
                       String destinatario, String nombre, String numero, String tipo, String medio, String direccion,
                       String estado, LocalDateTime fechaEficacia, boolean publicada, boolean historica, boolean requiereExpediente,
                       DocumentoMetadataDTO firmado, DocumentoMetadataDTO cargo, DocumentoMetadataDTO acuse,
                       List<DocumentoMetadataDTO> anexos) {}

    @Transactional(readOnly = true)
    public List<Acto> listar(Long expedienteId) {
        autorizacion.verificarExpedienteTtaipAccesible(expedienteId);
        return expedientes.listarNotificaciones(expedienteId).stream()
                .filter(n -> autorizacion.esAdministradorOTtaip() || (publicada(n)
                        && autorizacion.esFuncionario() == (n.getDestinatario() == CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA)))
                .map(this::acto).toList();
    }

    @Transactional
    public Acto editarDestino(Long expedienteId, Long id, Destino destino) {
        var n = bloquear(expedienteId, id);
        editable(n);
        if (archivo(n, Documento.TipoDocumento.CARGO_NOTIFICACION_TTAIP) != null
                || archivo(n, Documento.TipoDocumento.ACUSE_NOTIFICACION_TTAIP) != null) {
            throw new ConflictoEstadoException("El destino queda fijado al registrar el cargo o acuse");
        }
        if (destino.medio() == null) throw new IllegalArgumentException("Seleccione el medio de notificación");
        String direccion = destino.direccion() == null ? "" : destino.direccion().trim();
        if (destino.medio() == Solicitud.CanalNotificacion.CORREO_ELECTRONICO
                && (direccion.length() > 150 || !direccion.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) {
            throw new IllegalArgumentException("Ingrese un correo electrónico válido");
        }
        if (destino.medio() == Solicitud.CanalNotificacion.FISICA && direccion.isBlank()) {
            throw new IllegalArgumentException("Ingrese la dirección física de notificación");
        }
        var cedula = n.getCedula();
        if (destino.tipo() != null && !destino.tipo().name().equals(cedula.getTipoActo())) {
            if (firmado(n) != null) throw new ConflictoEstadoException("El tipo queda fijado al cargar el documento firmado");
            cedula.setTipoActo(destino.tipo().name());
            cedula.setDocumentoReferencia((destino.tipo() == TipoActo.CARTA ? "CARTA" : "CÉDULA")
                    + " DE NOTIFICACIÓN N.° " + cedula.getNumeroCedula());
        }
        n.setMedio(destino.medio().name());
        n.setMedioNotificacion(destino.medio().name());
        cedula.setCanal(destino.medio().name());
        if (destino.medio() == Solicitud.CanalNotificacion.CORREO_ELECTRONICO) {
            n.setDestinatarioEmail(direccion);
            cedula.setDestinatarioEmail(direccion);
        }
        n.setDireccionDestino(destino.medio() == Solicitud.CanalNotificacion.FISICA ? direccion : null);
        return acto(n);
    }

    @Transactional
    public Acto subir(Long expedienteId, Long id, TipoArchivo tipo, MultipartFile archivo) {
        var n = bloquear(expedienteId, id);
        editable(n);
        var cedula = n.getCedula();
        if (cedula.getTipoActo() == null) cedula.setTipoActo(TipoActo.CEDULA.name());
        var tipoDocumento = switch (tipo) {
            case FIRMADO -> "CARTA".equals(cedula.getTipoActo()) ? Documento.TipoDocumento.CARTA_NOTIFICACION_TTAIP
                    : Documento.TipoDocumento.CEDULA_NOTIFICACION;
            case CARGO -> Documento.TipoDocumento.CARGO_NOTIFICACION_TTAIP;
            case ACUSE -> Documento.TipoDocumento.ACUSE_NOTIFICACION_TTAIP;
        };
        if (tipo == TipoArchivo.FIRMADO) {
            DocumentosOficialesTtaipService.validarPdf(archivo);
            if (archivo(n, Documento.TipoDocumento.CARGO_NOTIFICACION_TTAIP) != null
                    || archivo(n, Documento.TipoDocumento.ACUSE_NOTIFICACION_TTAIP) != null) {
                throw new ConflictoEstadoException("El documento notificado ya tiene evidencia asociada");
            }
        } else if (firmado(n) == null || !publicada(n)) {
            throw new ConflictoEstadoException("Publique primero el documento de notificación firmado");
        }
        String nombre = switch (tipo) {
            case FIRMADO -> "CARTA".equals(cedula.getTipoActo()) ? "Carta de notificación " : "Cédula de notificación ";
            case CARGO -> "Cargo de notificación ";
            case ACUSE -> "Acuse de notificación ";
        };
        Documento nuevo = new Documento();
        nuevo.setTipoDocumento(tipoDocumento);
        nuevo.setCedulaNotificacion(cedula);
        var anterior = archivo(n, tipoDocumento);
        if (anterior != null) anterior.setEstado(Documento.EstadoDocumento.ELIMINADO);
        var guardado = documentos.subirActoTtaip(archivo, nuevo,
                nombre + cedula.getNumeroCedula().replace('/', '-') + extension(archivo));
        if (cedula.getDocumentos() == null) cedula.setDocumentos(new ArrayList<>());
        if (!cedula.getDocumentos().contains(guardado)) cedula.getDocumentos().add(guardado);
        return acto(n);
    }

    @Transactional
    public Acto publicar(Long expedienteId, Long id) {
        var n = bloquear(expedienteId, id);
        if (publicada(n)) return acto(n);
        editable(n);
        if (firmado(n) == null) throw new ConflictoEstadoException("Adjunte el documento de reemplazo firmado");
        n.getCedula().setEstado("EMITIDA_REPROCESO");
        return acto(n);
    }

    private static boolean publicada(NotificacionTtaip n) {
        return !"BORRADOR_REPROCESO".equals(n.getCedula().getEstado());
    }

    @Transactional
    public Acto revisar(Long expedienteId, Long id, Revision revision) {
        var n = bloquear(expedienteId, id);
        if (!revision.valida()) {
            var previo = reprocesos.findFirstByNotificacion_IdNotificacion(id);
            if (previo.isPresent()) return acto(previo.get().getNotificacionNueva());
            editable(n);
            var c = n.getCedula();
            if (c.getTipoActo() == null) c.setTipoActo("CEDULA");
            return acto(expedientes.reprocesarNotificacionFallida(c.getNumeroCedula(), c.getDestinatario(),
                    revision.observacion(), actor()).getNotificacionNueva());
        }
        if ("VALIDADA".equals(n.getEstado()) && n.getFechaEficacia() != null) {
            expedientes.abrirDescargosPorNotificacion(n, actor());
            var resolucion = n.getCedula().getResolucion();
            if (resolucion.isActosDocumentales()) cerrarActosSiCompletos(n.getExpediente(), resolucion);
            return acto(n);
        }
        editable(n);
        var fecha = revision.fechaEficacia();
        var emision = n.getCedula().getFechaEmision();
        // The date-only form sends midnight through the existing timestamp contract.
        boolean soloFecha = fecha != null && fecha.toLocalTime().equals(LocalTime.MIDNIGHT);
        var inicioPermitido = soloFecha ? emision.toLocalDate().atStartOfDay() : emision.withSecond(0).withNano(0);
        if (fecha == null || fecha.isAfter(LocalDateTime.now())
                || fecha.isBefore(inicioPermitido)) {
            throw new IllegalArgumentException("Indique la fecha eficaz acreditada por los documentos");
        }
        if (fecha.isBefore(emision)) fecha = emision;
        var actos = acto(n);
        if (!actos.publicada() || actos.firmado() == null || actos.cargo() == null || actos.acuse() == null) {
            throw new ConflictoEstadoException("Para validar hacen falta el documento firmado, el cargo y el acuse");
        }
        n.setFechaEficacia(fecha);
        if (n.getCedula().getTipoActo() == null) n.getCedula().setTipoActo(TipoActo.CEDULA.name());
        var validada = expedientes.validarNotificacionManualmente(expedienteId, id,
                new ValidarNotificacionManualRequest(null, actor(), revision.observacion(), null, null, fecha));
        Resolucion resolucion = n.getCedula().getResolucion();
        expedientes.abrirDescargosPorNotificacion(validada, actor());
        if (resolucion.isActosDocumentales()) cerrarActosSiCompletos(validada.getExpediente(), resolucion);
        return acto(validada);
    }

    private void cerrarActosSiCompletos(ExpedienteTtaip expediente, Resolucion resolucion) {
        var destinatarios = new ArrayList<>(List.of(CedulaNotificacion.DestinatarioNotificacion.CIUDADANO));
        if (resolucion.getDecision() != Resolucion.DecisionResolucion.INADMISIBLE) {
            destinatarios.add(CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA);
        }
        for (var destinatario : destinatarios) {
            boolean validada = notificaciones.findByCedula_Resolucion_IdResolucionAndDestinatarioOrderByFechaNotificacionDesc(
                    resolucion.getId(), destinatario).stream()
                    .anyMatch(n -> expediente.getId().equals(n.getExpediente().getId())
                            && n.getCedula().getDestinatario() == destinatario && transiciones.evidenciaEficaz(n));
            if (!validada) return;
        }
        if (resolucion.getFechaValidacionActos() == null) resolucion.setFechaValidacionActos(LocalDateTime.now());
        var admision = ExpedienteTtaipService.resolucionAdmision(expediente);
        if (!ExpedienteTtaipService.admisionAbierta(expediente) || !Objects.equals(resolucion.getId(), admision == null ? null : admision.getId())) return;
        if (expediente.getApelacion().getEstado() == Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION) {
            transiciones.validarAvanceSegunda(expediente.getApelacion());
        }
        expedientes.avanzarSegundaNotificada(expediente);
    }

    private NotificacionTtaip bloquear(Long expedienteId, Long id) {
        transiciones.bloquearNotificacion(expedienteId, id);
        return notificaciones.findByIdNotificacionAndExpediente_IdExpedienteTtaip(id, expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Notificación no encontrada"));
    }

    private static void editable(NotificacionTtaip n) {
        if ("VALIDADA".equals(n.getEstado()) || "REPROCESO_REQUERIDO".equals(n.getResultadoNotificacion())) {
            throw new ConflictoEstadoException("La notificación ya fue validada o sustituida por un reproceso");
        }
    }

    private Acto acto(NotificacionTtaip n) {
        var cedula = n.getCedula();
        var r = cedula.getResolucion();
        boolean expediente = r.getDecision() == Resolucion.DecisionResolucion.INADMISIBLE
                || ((r.getDecision() == Resolucion.DecisionResolucion.ADMISIBLE || r.getDecision() == Resolucion.DecisionResolucion.ADMITIDO)
                && n.getDestinatario() == CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA);
        return new Acto(n.getId(), r.getId(), r.getNumeroResolucion(), r.getTipoResolucion().name(), r.getDecision().name(),
                n.getDestinatario().name(), n.getDestinatarioNombre(), cedula.getNumeroCedula(),
                cedula.getTipoActo() == null ? "CEDULA" : cedula.getTipoActo(), n.getMedioNotificacion(),
                "FISICA".equals(n.getMedioNotificacion()) ? n.getDireccionDestino() : n.getDestinatarioEmail(),
                n.getEstado(), n.getFechaEficacia(), publicada(n), !r.isActosDocumentales() && cedula.getTipoActo() == null,
                expediente, metadata(firmado(n)), metadata(archivo(n, Documento.TipoDocumento.CARGO_NOTIFICACION_TTAIP)),
                metadata(archivo(n, Documento.TipoDocumento.ACUSE_NOTIFICACION_TTAIP)), anexos(r, expediente));
    }

    private List<DocumentoMetadataDTO> anexos(Resolucion resolucion, boolean incluirExpediente) {
        var resultado = new java.util.LinkedHashMap<Long, DocumentoMetadataDTO>();
        agregarAnexos(resultado, resolucion.getDocumentos());
        if (incluirExpediente) {
            var apelacion = resolucion.getApelacion();
            agregarAnexos(resultado, apelacion.getDocumentos());
            agregarAnexos(resultado, resolucion.getExpedienteTtaip().getDocumentos());
            var solicitud = apelacion.getSolicitud();
            if (solicitud != null) {
                agregarAnexos(resultado, solicitud.getDocumentos());
                if (solicitud.getRespuesta() != null) agregarAnexos(resultado, solicitud.getRespuesta().getDocumentos());
            }
        }
        return List.copyOf(resultado.values());
    }

    private void agregarAnexos(java.util.Map<Long, DocumentoMetadataDTO> resultado, List<Documento> adjuntos) {
        if (adjuntos == null) return;
        adjuntos.stream().filter(d -> d.getEstado() == Documento.EstadoDocumento.ACTIVO
                        && d.getPresentacionAdmision() == null
                        && (!d.isSoloInstitucionalTtaip() || autorizacion.esFuncionario() || autorizacion.esAdministradorOTtaip()))
                .map(DocumentoMetadataDTO::from).forEach(d -> resultado.putIfAbsent(d.id(), d));
    }

    private Documento firmado(NotificacionTtaip n) {
        return archivo(n, "CARTA".equals(n.getCedula().getTipoActo()) ? Documento.TipoDocumento.CARTA_NOTIFICACION_TTAIP
                : Documento.TipoDocumento.CEDULA_NOTIFICACION);
    }

    private Documento archivo(NotificacionTtaip n, Documento.TipoDocumento tipo) {
        return archivos.findByCedulaNotificacion_IdCedulaAndEstadoOrderByFechaCreacionDesc(
                n.getCedula().getId(), Documento.EstadoDocumento.ACTIVO).stream()
                .filter(d -> Objects.equals(d.getTipoDocumento(), tipo)).findFirst().orElse(null);
    }

    private static DocumentoMetadataDTO metadata(Documento doc) {
        return doc == null ? null : DocumentoMetadataDTO.from(doc);
    }

    private static String extension(MultipartFile archivo) {
        String nombre = archivo.getOriginalFilename();
        int punto = nombre == null ? -1 : nombre.lastIndexOf('.');
        return punto >= 0 && nombre.substring(punto).matches("\\.[A-Za-z0-9]{1,10}") ? nombre.substring(punto) : "";
    }

    private String actor() { return String.valueOf(autorizacion.obtenerUsuarioActual().getIdUsuario()); }
}
