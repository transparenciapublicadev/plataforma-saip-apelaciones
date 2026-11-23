package pe.gob.saip.backend.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static pe.gob.saip.backend.model.entity.Apelacion.EstadoApelacion.*;
import static pe.gob.saip.backend.model.entity.CedulaNotificacion.DestinatarioNotificacion.*;
import static pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip.Adjunto.*;
import static pe.gob.saip.backend.model.entity.CumplimientoResolucionTtaip.EstadoCumplimiento.*;

@Service
@RequiredArgsConstructor
public class CumplimientoDocumentalTtaipService {
    private final CumplimientoResolucionTtaipRepository seguimientos;
    private final NotificacionTtaipRepository notificaciones;
    private final DocumentoRepository archivos;
    private final DocumentoService documentos;
    private final HistorialTtaipRepository historial;
    private final ApelacionRepository apelaciones;
    private final EntityManager em;
    private final PlazoCalculadorService calendario;
    private final TransicionesApelacionTtaipService transiciones;
    private final AutorizacionRecursosService autorizacion;

    public record Adjunto(CumplimientoResolucionTtaip.Adjunto clase, DocumentoMetadataDTO documento) {}

    public record FaseCumplimientoTtaip(Long id, String numeroExpediente, String numeroResolucion, String entidad,
            CumplimientoResolucionTtaip.EstadoCumplimiento estado, LocalDate fechaNotificacionEntidad,
            LocalDate fechaLimite, LocalDateTime fechaEntrega, LocalDate fechaEficaciaEntrega,
            LocalDate fechaRemision, String numeroOficio, String fundamento, UUID operacionEntrega,
            UUID operacionValidacion, UUID operacionRemision, boolean puedeEntregar,
            boolean puedeValidar, boolean puedeRemitir, boolean expedienteResuelto, List<Adjunto> documentos) {}

    public record ConsultaCumplimientoTtaip(FaseCumplimientoTtaip cumplimiento) {}

    static boolean exigeCumplimiento(Resolucion.DecisionResolucion decision) {
        return decision == Resolucion.DecisionResolucion.FUNDADO || decision == Resolucion.DecisionResolucion.FUNDADO_EN_PARTE;
    }

    /** Called with the appeal row locked by the notification command. */
    void alAcreditarNotificacion(NotificacionTtaip notificacion, LocalDateTime fechaAcreditada) {
        var resolucion = notificacion.getCedula().getResolucion();
        var expediente = notificacion.getExpediente();
        if (resolucion.getTipoResolucion() != Resolucion.TipoResolucion.RESOLUCION_FINAL
                || !esperaNotificaciones(expediente)) return;
        if (fechaAcreditada != null) {
            if (fechaAcreditada.toLocalDate().isBefore(resolucion.getFechaResolucion().toLocalDate())
                    || fechaAcreditada.isAfter(LocalDateTime.now(pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA))) {
                throw new IllegalArgumentException("La fecha eficaz debe corresponder a la resolución emitida");
            }
            notificacion.setFechaEficacia(fechaAcreditada);
        }
        var entidad = notificacionEficaz(resolucion, ENTIDAD_PUBLICA);
        if (entidad == null) return;
        boolean ambas = notificacionEficaz(resolucion, CIUDADANO) != null;
        if (ambas && resolucion.getFechaValidacionActos() == null) resolucion.setFechaValidacionActos(ahora());
        if (!exigeCumplimiento(resolucion.getDecision())) {
            if (ambas) {
                cambiarEstado(expediente, estadoFinal(resolucion), "Se acreditó la notificación final a ambas partes",
                        resolucion.getNumeroResolucion());
            }
            return;
        }
        var seguimiento = seguimientos.findByExpediente_IdExpedienteTtaipAndIdNotificacionInicioIsNotNull(expediente.getId())
                .orElseGet(() -> abrir(expediente, resolucion, entidad));
        if (!vencerSiCorresponde(seguimiento, calendario.hoy())) cerrarSiCorresponde(seguimiento);
    }

    static boolean esperaNotificaciones(ExpedienteTtaip expediente) {
        var estado = expediente.getApelacion().getEstado();
        return estado == NOTIFICACION_RESOLUCION_FINAL || estado == EN_CUMPLIMIENTO;
    }

    private CumplimientoResolucionTtaip abrir(ExpedienteTtaip expediente, Resolucion resolucion, NotificacionTtaip entidad) {
        var seguimiento = new CumplimientoResolucionTtaip();
        seguimiento.setExpediente(expediente);
        seguimiento.setApelacion(expediente.getApelacion());
        seguimiento.setResolucion(resolucion);
        seguimiento.setEntidad(expediente.getApelacion().getEntidadApeladaEfectiva());
        seguimiento.setIdNotificacionInicio(entidad.getId());
        seguimiento.setFechaRequerimientoCumplimiento(entidad.getFechaEficacia().toLocalDate());
        seguimiento.setFechaLimiteCumplimiento(calendario.calcularFechaVencimiento(
                seguimiento.getFechaRequerimientoCumplimiento(), 7, seguimiento.getEntidad().getId()));
        seguimiento.setEstadoCumplimiento(PENDIENTE);
        seguimientos.save(seguimiento);
        cambiarEstado(expediente, EN_CUMPLIMIENTO, "Se habilitó el cumplimiento de la resolución final", referencia(seguimiento));
        registrar(expediente, HistorialTtaip.TipoEvento.CUMPLIMIENTO_REQUERIDO,
                "Plazo de siete días hábiles desde la notificación eficaz a la entidad", referencia(seguimiento), null, null, "SISTEMA");
        return seguimiento;
    }

    @Transactional(readOnly = true)
    public ConsultaCumplimientoTtaip consultar(Long expedienteId) {
        autorizacion.verificarExpedienteTtaipAccesible(expedienteId);
        boolean entidad = autorizacion.esFuncionario();
        boolean tribunal = autorizacion.esAdministradorOTtaip();
        var fase = seguimientos.findByExpediente_IdExpedienteTtaipAndIdNotificacionInicioIsNotNull(expedienteId)
                .filter(c -> entidad || tribunal || c.getFechaEntrega() != null)
                .map(c -> dto(c, entidad, tribunal)).orElse(null);
        return new ConsultaCumplimientoTtaip(fase);
    }

    @Transactional
    public FaseCumplimientoTtaip entregar(Long expedienteId, UUID operacion, MultipartFile respuesta, List<MultipartFile> anexos) {
        var seguimiento = bloquearEntidad(expedienteId);
        if (operacion.equals(seguimiento.getOperacionEntrega())) return dto(seguimiento, true, false);
        exigirPendiente(seguimiento, seguimiento.getOperacionEntrega() == null);
        guardar(seguimiento, respuesta, RESPUESTA);
        guardarAnexos(seguimiento, anexos, ANEXO_RESPUESTA);
        seguimiento.setOperacionEntrega(operacion);
        seguimiento.setFechaEntrega(ahora());
        seguimiento.setIdActorEntrega(autorizacion.obtenerUsuarioActual().getIdUsuario());
        auditar(seguimiento, "Respuesta y anexos publicados para el administrado", seguimiento.getIdActorEntrega());
        return dto(seguimiento, true, false);
    }

    @Transactional
    public FaseCumplimientoTtaip validarEntrega(Long expedienteId, UUID operacion, LocalDate fechaEficacia,
            MultipartFile cargo, MultipartFile acuse) {
        var seguimiento = bloquearEntidad(expedienteId);
        if (operacion.equals(seguimiento.getOperacionValidacionEntrega())) return dto(seguimiento, true, false);
        exigirPendiente(seguimiento, seguimiento.getFechaEntrega() != null && seguimiento.getFechaValidacionEntrega() == null);
        if (fechaEficacia.isBefore(seguimiento.getFechaEntrega().toLocalDate()) || fechaEficacia.isAfter(calendario.hoy())) {
            throw new IllegalArgumentException("Indique una fecha de notificación acreditada entre la entrega y hoy");
        }
        guardar(seguimiento, cargo, CARGO);
        guardar(seguimiento, acuse, ACUSE);
        seguimiento.setOperacionValidacionEntrega(operacion);
        seguimiento.setFechaEficaciaEntrega(fechaEficacia);
        seguimiento.setFechaValidacionEntrega(ahora());
        seguimiento.setIdActorValidacion(autorizacion.obtenerUsuarioActual().getIdUsuario());
        auditar(seguimiento, "La entidad validó el cargo y acuse de la entrega", seguimiento.getIdActorValidacion());
        return dto(seguimiento, true, false);
    }

    @Transactional
    public FaseCumplimientoTtaip remitir(Long expedienteId, UUID operacion, String numeroOficio, String fundamento,
            MultipartFile oficio, List<MultipartFile> anexos) {
        var seguimiento = bloquearEntidad(expedienteId);
        if (operacion.equals(seguimiento.getOperacionRemision())) return dto(seguimiento, true, false);
        exigirPendiente(seguimiento, seguimiento.getFechaValidacionEntrega() != null);
        guardar(seguimiento, oficio, OFICIO);
        guardarAnexos(seguimiento, anexos, ANEXO_OFICIO);
        seguimiento.setOperacionRemision(operacion);
        seguimiento.setNumeroOficio(numeroOficio.strip());
        seguimiento.setDescripcionCumplimiento(fundamento.strip());
        seguimiento.setReferenciaDocumento(numeroOficio.strip());
        seguimiento.setFechaCumplimiento(calendario.hoy());
        var actor = autorizacion.obtenerUsuarioActual().getIdUsuario();
        seguimiento.setIdActorRemision(actor);
        seguimiento.setResponsableEntidad(actor.toString());
        seguimiento.setEstadoCumplimiento(CUMPLIDO);
        registrar(seguimiento.getExpediente(), HistorialTtaip.TipoEvento.CUMPLIMIENTO_PRESENTADO,
                "Cumplimiento recibido con oficio, entrega y evidencias", referencia(seguimiento),
                PENDIENTE.name(), CUMPLIDO.name(), actor.toString());
        cerrarSiCorresponde(seguimiento);
        return dto(seguimiento, true, false);
    }

    @Scheduled(cron = "0 0 * * * *", zone = "America/Lima")
    @Transactional
    public int procesarVencidos() {
        var hoy = calendario.hoy();
        int vencidos = 0;
        for (var id : seguimientos.buscarDocumentalesVencidos(hoy)) {
            var seguimiento = seguimientos.findById(id).orElseThrow();
            apelaciones.findByIdForUpdate(seguimiento.getApelacion().getId()).orElseThrow();
            em.refresh(seguimiento);
            em.refresh(seguimiento.getApelacion());
            em.refresh(seguimiento.getExpediente());
            if (vencerSiCorresponde(seguimiento, hoy)) vencidos++;
        }
        return vencidos;
    }

    private boolean vencerSiCorresponde(CumplimientoResolucionTtaip c, LocalDate hoy) {
        if (c.getEstadoCumplimiento() != PENDIENTE || !hoy.isAfter(c.getFechaLimiteCumplimiento())) return false;
        c.setEstadoCumplimiento(VENCIDO);
        c.setTipoCumplimiento(CumplimientoResolucionTtaip.TipoCumplimiento.NO_CUMPLE);
        registrar(c.getExpediente(), HistorialTtaip.TipoEvento.CUMPLIMIENTO_VENCIDO,
                "Venció el plazo sin remisión de cumplimiento", referencia(c), PENDIENTE.name(), VENCIDO.name(), "SISTEMA");
        cerrarSiCorresponde(c);
        return true;
    }

    private void cerrarSiCorresponde(CumplimientoResolucionTtaip c) {
        if (c.getApelacion().isResuelta() || c.getResolucion().getFechaValidacionActos() == null
                || c.getEstadoCumplimiento() == PENDIENTE) return;
        var detalle = c.getEstadoCumplimiento() == CUMPLIDO ? "cumplimiento" : "incumplimiento";
        cambiarEstado(c.getExpediente(), estadoFinal(c.getResolucion()),
                "Expediente resuelto con " + detalle + " de la entidad", referencia(c));
    }

    private NotificacionTtaip notificacionEficaz(Resolucion r, CedulaNotificacion.DestinatarioNotificacion parte) {
        return notificaciones.findByCedula_Resolucion_IdResolucionAndDestinatarioOrderByFechaNotificacionDesc(r.getId(), parte)
                .stream()
                .filter(n -> n.getFechaEficacia() != null && Objects.equals(n.getExpediente().getId(), r.getExpedienteTtaip().getId())
                        && n.getCedula().getDestinatario() == parte && transiciones.evidenciaEficaz(n))
                .min(Comparator.comparing(NotificacionTtaip::getFechaEficacia)).orElse(null);
    }

    private CumplimientoResolucionTtaip bloquearEntidad(Long expedienteId) {
        if (!autorizacion.esFuncionario()) throw new AccessDeniedException("La actuación corresponde a la entidad requerida");
        transiciones.bloquearExpedienteAccesible(expedienteId);
        var seguimiento = seguimientos.findByExpediente_IdExpedienteTtaipAndIdNotificacionInicioIsNotNull(expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException("El expediente no tiene un cumplimiento documental"));
        autorizacion.verificarEntidadInstitucional(seguimiento.getEntidad().getId());
        return seguimiento;
    }

    private boolean pendiente(CumplimientoResolucionTtaip c) {
        return c.getEstadoCumplimiento() == PENDIENTE && c.getApelacion().getEstado() == EN_CUMPLIMIENTO
                && !calendario.hoy().isAfter(c.getFechaLimiteCumplimiento());
    }

    private void exigirPendiente(CumplimientoResolucionTtaip c, boolean pasoDisponible) {
        if (!pendiente(c) || !pasoDisponible) {
            throw new ConflictoEstadoException("El plazo concluyó o este paso del cumplimiento no está disponible");
        }
    }

    private void guardar(CumplimientoResolucionTtaip cumplimiento, MultipartFile archivo,
            CumplimientoResolucionTtaip.Adjunto clase) {
        var documento = new Documento();
        documento.setTipoDocumento(Documento.TipoDocumento.DOCUMENTO_ADJUNTO);
        documento.setCumplimiento(cumplimiento);
        documento.setClaseAdjuntoCumplimiento(clase);
        documentos.subirActoTtaip(archivo, documento, null);
    }

    private void guardarAnexos(CumplimientoResolucionTtaip c, List<MultipartFile> anexos,
            CumplimientoResolucionTtaip.Adjunto clase) {
        if (anexos != null) {
            for (var archivo : anexos) guardar(c, archivo, clase);
        }
    }

    private FaseCumplimientoTtaip dto(CumplimientoResolucionTtaip c, boolean entidad, boolean tribunal) {
        boolean remitido = c.getOperacionRemision() != null;
        boolean verEntrega = entidad || !tribunal || remitido;
        boolean puedeEditar = entidad && pendiente(c);
        var adjuntos = verEntrega ? archivos.findByCumplimiento_IdCumplimientoAndEstadoOrderByIdDocumentoAsc(
                c.getId(), Documento.EstadoDocumento.ACTIVO).stream()
                .filter(d -> entidad || (tribunal && remitido) || d.getClaseAdjuntoCumplimiento().visibleAlAdministrado())
                .map(d -> new Adjunto(d.getClaseAdjuntoCumplimiento(), DocumentoMetadataDTO.from(d))).toList() : List.<Adjunto>of();
        return new FaseCumplimientoTtaip(c.getId(), c.getExpediente().getNumeroExpediente(),
                c.getResolucion().getNumeroResolucion(), c.getEntidad().getNombre(), c.getEstadoCumplimiento(),
                c.getFechaRequerimientoCumplimiento(), c.getFechaLimiteCumplimiento(),
                verEntrega ? c.getFechaEntrega() : null, (entidad || remitido) ? c.getFechaEficaciaEntrega() : null,
                c.getFechaCumplimiento(), (entidad || tribunal) ? c.getNumeroOficio() : null,
                (entidad || tribunal) ? c.getDescripcionCumplimiento() : null,
                entidad ? c.getOperacionEntrega() : null, entidad ? c.getOperacionValidacionEntrega() : null,
                entidad ? c.getOperacionRemision() : null,
                puedeEditar && c.getFechaEntrega() == null,
                puedeEditar && c.getFechaEntrega() != null && c.getFechaValidacionEntrega() == null,
                puedeEditar && c.getFechaValidacionEntrega() != null, c.getApelacion().isResuelta(), adjuntos);
    }

    private void auditar(CumplimientoResolucionTtaip c, String descripcion, Long actor) {
        registrar(c.getExpediente(), HistorialTtaip.TipoEvento.AUDITORIA, descripcion, referencia(c), null, null, actor.toString());
    }

    private static String referencia(CumplimientoResolucionTtaip c) {
        return "CUMPLIMIENTO-" + c.getId();
    }

    private void cambiarEstado(ExpedienteTtaip exp, Apelacion.EstadoApelacion estado, String descripcion, String ref) {
        var anterior = exp.getApelacion().getEstado();
        exp.getApelacion().setEstado(estado);
        exp.setEstado(estado);
        registrar(exp, HistorialTtaip.TipoEvento.CAMBIO_ESTADO, descripcion, ref, anterior.name(), estado.name(), "SISTEMA");
    }

    private void registrar(ExpedienteTtaip exp, HistorialTtaip.TipoEvento evento, String descripcion, String ref,
            String anterior, String nuevo, String actor) {
        var registro = new HistorialTtaip();
        registro.setExpediente(exp);
        registro.setTipoEvento(evento);
        registro.setDescripcion(descripcion);
        registro.setReferencia(ref);
        registro.setEstadoAnterior(anterior);
        registro.setEstadoNuevo(nuevo);
        registro.setActor(actor);
        registro.setFechaEvento(ahora());
        historial.save(registro);
    }

    private static Apelacion.EstadoApelacion estadoFinal(Resolucion r) {
        return switch (r.getDecision()) {
            case FUNDADO -> RESUELTO_FUNDADO;
            case FUNDADO_EN_PARTE -> RESUELTO_FUNDADO_EN_PARTE;
            case INFUNDADO -> RESUELTO_INFUNDADO;
            case INFUNDADO_EN_PARTE -> RESUELTO_INFUNDADO_EN_PARTE;
            case IMPROCEDENTE -> RESUELTO_IMPROCEDENTE;
            case CONCLUSION_SUSTRACCION_MATERIA -> CONCLUSION_SUSTRACCION_MATERIA;
            case CONCLUSION_DESISTIMIENTO -> CONCLUSION_DESISTIMIENTO;
            case ESTESE_A_LO_RESUELTO -> RESUELTO_ESTESE_A_LO_RESUELTO;
            case NULIDAD_DEL_ACTO -> RESUELTO_NULIDAD_ACTO;
            default -> throw new ConflictoEstadoException("El sentido no corresponde a una resolución final");
        };
    }

    private static LocalDateTime ahora() {
        return LocalDateTime.now(pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA);
    }
}
