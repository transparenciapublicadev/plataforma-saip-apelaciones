package pe.gob.saip.backend.service;

import java.util.Comparator;
import java.util.Locale;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

/** Guards aggregate transitions. A state label, stored file or technical send is not a legal act. */
@Service
public class TransicionesApelacionTtaipService {
    private final ApelacionRepository apelaciones;
    private final ResolucionRepository resoluciones;
    private final SubsanacionTtaipRecepcionRepository recepciones;
    private final NotificacionTtaipRepository notificaciones;
    private final HistorialTtaipRepository historial;
    private final DescargoEntidadTtaipRepository descargos;
    private final AutorizacionRecursosService autorizacion;
    private final EntityManager em;
    private final SuspensionPlazoTtaipRepository suspensiones;

    public TransicionesApelacionTtaipService(ApelacionRepository apelaciones, ResolucionRepository resoluciones,
            SubsanacionTtaipRecepcionRepository recepciones, NotificacionTtaipRepository notificaciones,
            HistorialTtaipRepository historial, DescargoEntidadTtaipRepository descargos,
            AutorizacionRecursosService autorizacion, EntityManager em, SuspensionPlazoTtaipRepository suspensiones) {
        this.apelaciones=apelaciones; this.resoluciones=resoluciones; this.recepciones=recepciones;
        this.notificaciones=notificaciones; this.historial=historial; this.autorizacion=autorizacion; this.em=em;
        this.descargos=descargos;
        this.suspensiones=suspensiones;
    }

    /** All mutation use cases hold the same database row lock until their transaction commits. */
    @Transactional(propagation=Propagation.MANDATORY)
    public Apelacion bloquear(Long id) {
        autorizacion.verificarTtaipOAdministrador();
        return bloquearAccesible(id);
    }

    private Apelacion bloquearAccesible(Long id) {
        Apelacion ap=apelaciones.findByIdForUpdate(id)
            .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: "+id));
        // The repository's pessimistic query already holds the row lock. Refresh without a second
        // follow-on lock across optional eager associations (Hibernate 7).
        em.refresh(ap);
        autorizacion.verificarApelacionAccesible(ap);
        return ap;
    }

    /** Coordinates institutional evidence without changing the operation's existing role rules. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void bloquearExpedienteAccesible(Long expedienteId) {
        ExpedienteTtaip expediente=em.find(ExpedienteTtaip.class,expedienteId);
        if(expediente==null) throw new RecursoNoEncontradoException("Expediente no encontrado");
        bloquearAccesible(expediente.getApelacion().getId());
        em.refresh(expediente);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void bloquearNotificacion(Long expedienteId, Long notificacionId) {
        autorizacion.verificarTtaipOAdministrador();
        NotificacionTtaip n = notificaciones.findByIdNotificacionAndExpediente_IdExpedienteTtaip(notificacionId, expedienteId)
            .orElseThrow(() -> new RecursoNoEncontradoException("Notificación no encontrada en el expediente"));
        bloquear(n.getExpediente().getApelacion().getId());
        em.refresh(n);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void bloquearReproceso(String numeroCedula, CedulaNotificacion.DestinatarioNotificacion destinatario) {
        autorizacion.verificarTtaipOAdministrador();
        NotificacionTtaip n = notificaciones.findByCedula_NumeroCedulaAndDestinatario(numeroCedula, destinatario)
            .orElseThrow(() -> new RecursoNoEncontradoException("Notificación original no encontrada"));
        bloquearNotificacion(n.getExpediente().getId(), n.getId());
    }

    /** Compatibility endpoints may edit data or repeat the current label, never execute a missing act. */
    @Transactional
    public ApelacionDTO actualizarDatos(Long id, String estado, String fundamentos) {
        Apelacion ap=bloquear(id);
        if (estado!=null) {
            Apelacion.EstadoApelacion solicitado;
            try { solicitado=Apelacion.EstadoApelacion.valueOf(estado.trim().toUpperCase(Locale.ROOT)); }
            catch (IllegalArgumentException e) { throw new IllegalArgumentException("Estado no válido: "+estado); }
            if (solicitado!=ap.getEstado()) throw new ConflictoEstadoException(
                "El cambio de estado requiere su comando específico y las actuaciones acreditadas; no se permite mediante actualización genérica");
        }
        if (fundamentos!=null) ap.setFundamentos(fundamentos);
        return ApelacionDTO.from(apelaciones.save(ap));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void validarActuacion(Apelacion ap, Resolucion.TipoResolucion tipo, Resolucion.DecisionResolucion decision) {
        if (ap.getExpedienteTtaip() != null) {
            exigir(suspensiones.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(ap.getExpedienteTtaip().getId())
                    .stream().noneMatch(s -> s.getEtapaComplementaria() == tipo && InformacionComplementariaTtaipService.pendiente(s)),
                    "Hay un requerimiento de información complementaria pendiente en esta etapa");
        }
        if (tipo==Resolucion.TipoResolucion.RESOLUCION_FINAL) {
            exigir(ap.getEstado()==Apelacion.EstadoApelacion.EN_RESOLUCION && !ap.isResuelta(),
                "La resolución final requiere una apelación en EN_RESOLUCION");
            exigir(ultima(ap,Resolucion.TipoResolucion.RESOLUCION_FINAL)==null,"Ya existe una resolución final registrada");
            Resolucion admision=ultima(ap,Resolucion.TipoResolucion.SEGUNDA_CALIFICACION);
            if(admision!=null) exigirSubsanacion(ap);
            else admision=ultima(ap,Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
            exigirAdmision(ap,admision);
            exigirNotificaciones(ap,admision);
            exigirDescargos(ap,admision);
        } else if (decision==Resolucion.DecisionResolucion.TENER_POR_NO_PRESENTADO) {
            exigir(ap.getEstado()==Apelacion.EstadoApelacion.EN_SUBSANACION,
                "Tener por no presentado requiere subsanación pendiente, sin presentación recibida");
            Resolucion requerimiento=ultima(ap,Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
            exigir(requerimiento!=null && requerimiento.getDecision()==Resolucion.DecisionResolucion.INADMISIBLE,
                "Falta el requerimiento inadmisible registrado");
            exigir(recepciones.findByRequerimiento_IdResolucion(requerimiento.getId()).isEmpty(),
                "Existe una subsanación recibida; corresponde calificarla mediante su comando");
        } else if (tipo==Resolucion.TipoResolucion.PRIMERA_CALIFICACION) {
            exigir(ap.getEstado()==Apelacion.EstadoApelacion.EN_CALIFICACION_1,"La primera calificación requiere EN_CALIFICACION_1");
            exigir(ultima(ap,tipo)==null,"La primera calificación ya está registrada");
        } else if (tipo==Resolucion.TipoResolucion.SEGUNDA_CALIFICACION) {
            exigir(ap.getEstado()==Apelacion.EstadoApelacion.EN_CALIFICACION_2,"La segunda calificación requiere EN_CALIFICACION_2");
            exigirSubsanacion(ap);
            Resolucion primera = ultima(ap, Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
            if (primera != null && primera.isActosDocumentales()) exigirNotificaciones(ap, primera);
            exigir(ultima(ap,tipo)==null,"La segunda calificación ya está registrada");
        }
    }

    /** Verifies existing notifications; does not invent or send evidence and does not choose a clock base. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void validarAvanceSegunda(Apelacion ap) {
        exigir(ap.getEstado()==Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION
            || ap.getEstado()==Apelacion.EstadoApelacion.EN_RESOLUCION,
            "El avance requiere una segunda calificación admitida pendiente de notificación");
        exigirSubsanacion(ap);
        Resolucion segunda=ultima(ap,Resolucion.TipoResolucion.SEGUNDA_CALIFICACION);
        exigirAdmision(ap,segunda);
        exigirNotificaciones(ap,segunda);
    }

    private void exigirSubsanacion(Apelacion ap) {
        Resolucion requerimiento=ultima(ap,Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
        exigir(requerimiento!=null && requerimiento.getDecision()==Resolucion.DecisionResolucion.INADMISIBLE
            && recepciones.findByRequerimiento_IdResolucion(requerimiento.getId()).isPresent(),
            "La segunda calificación requiere inadmisibilidad y recepción de subsanación del mismo requerimiento");
    }
    private void exigirAdmision(Apelacion ap, Resolucion r) {
        exigir(r!=null && r.getExpedienteTtaip()!=null && ap.getExpedienteTtaip()!=null
            && r.getExpedienteTtaip().getId().equals(ap.getExpedienteTtaip().getId())
            && (r.getDecision()==Resolucion.DecisionResolucion.ADMISIBLE || r.getDecision()==Resolucion.DecisionResolucion.ADMITIDO),
            "Falta la resolución de admisión del mismo expediente");
    }
    private void exigirDescargos(Apelacion ap, Resolucion admision) {
        var registrados=descargos.findByExpediente_IdExpedienteTtaipOrderByFechaRequerimientoDesc(ap.getExpedienteTtaip().getId());
        exigir(registrados.stream().noneMatch(d -> d.getEstadoDescargo()==DescargoEntidadTtaip.EstadoDescargo.REQUERIDO),
            "Los descargos requeridos deben presentarse o procesarse como vencidos antes de resolver");
        boolean concluido=registrados.stream().anyMatch(d -> d.getApelacion()!=null && d.getApelacion().getId().equals(ap.getId())
            && ap.getEntidadApeladaEfectiva()!=null && d.getEntidad()!=null && d.getEntidad().getId().equals(ap.getEntidadApeladaEfectiva().getId())
            && d.getFechaRequerimiento()!=null && !d.getFechaRequerimiento().isBefore(admision.getFechaResolucion().toLocalDate())
            && (((d.getEstadoDescargo()==DescargoEntidadTtaip.EstadoDescargo.PRESENTADO
                    || d.getEstadoDescargo()==DescargoEntidadTtaip.EstadoDescargo.PRESENTADO_EXTEMPORANEO)
                    && d.getFechaPresentacion()!=null && texto(d.getResumenDescargo()))
                || (d.getEstadoDescargo()==DescargoEntidadTtaip.EstadoDescargo.VENCIDO_SIN_PRESENTACION
                    && d.getFechaLimiteDescargo()!=null && java.time.LocalDate.now().isAfter(d.getFechaLimiteDescargo()))));
        exigir(concluido,"Falta el requerimiento de descargos de la admisión y su presentación o vencimiento registrado");
    }
    private Resolucion ultima(Apelacion ap, Resolucion.TipoResolucion tipo) {
        return resoluciones.findByApelacion_Id(ap.getId()).stream().filter(r->r.getTipoResolucion()==tipo)
            .max(Comparator.comparing(Resolucion::getFechaResolucion,Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(Resolucion::getId,Comparator.nullsFirst(Comparator.naturalOrder()))).orElse(null);
    }
    private void exigirNotificaciones(Apelacion ap, Resolucion r) {
        for (var destinatario : CedulaNotificacion.DestinatarioNotificacion.values()) {
            if (r.getDecision() == Resolucion.DecisionResolucion.INADMISIBLE
                    && destinatario == CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA) continue;
            boolean eficaz=notificaciones.findByCedula_Resolucion_IdResolucionAndDestinatarioOrderByFechaNotificacionDesc(r.getId(),destinatario)
                .stream().anyMatch(n -> n.getExpediente()!=null && n.getExpediente().getId().equals(ap.getExpedienteTtaip().getId())
                    && n.getCedula()!=null && n.getCedula().getDestinatario()==destinatario && evidenciaEficaz(n));
            exigir(eficaz,"Valide los actos de notificación de " + r.getNumeroResolucion() + " para " + destinatario);
        }
    }
    private boolean evidenciaEficaz(NotificacionTtaip n) {
        // Provider sends can overwrite operational fields while an old receipt remains in history.
        // They never acquire legal efficacy by borrowing that earlier event.
        if(n.getResultadoNotificacion()!=null && n.getResultadoNotificacion().startsWith("ENTREGADA_POR_")) return false;
        if (n.getCedula().getResolucion().isActosDocumentales() || n.getCedula().getTipoActo() != null) {
            return "VALIDADA".equals(n.getEstado()) && n.getFechaEficacia() != null;
        }
        Long expedienteId=n.getExpediente().getId();
        if ("VALIDADA".equals(n.getEstado()) && Boolean.TRUE.equals(n.getValidadaManualmente())
                && n.getFechaValidacionManual()!=null && texto(n.getResponsableValidacion()) && texto(n.getObservacionValidacion())) {
            return historial.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferencia(expedienteId,
                HistorialTtaip.TipoEvento.NOTIFICACION_VALIDADA,"NOTIFICACION-"+n.getId()+":VALIDACION_MANUAL");
        }
        String medio=n.getMedioNotificacion()!=null ? n.getMedioNotificacion() : n.getMedio();
        return "ENTREGADA".equals(n.getEstado()) && "ENTREGADO".equals(n.getEstadoAcuse())
            && n.getFechaAcuse()!=null && texto(n.getAcuseAutomatico())
            && (medio==null || !medio.startsWith("CORREO") || texto(n.getConstanciaEnvio()))
            && historial.existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferencia(expedienteId,
                HistorialTtaip.TipoEvento.ACUSE_NOTIFICACION_REGISTRADO,"NOTIFICACION-"+n.getId()+":ACUSE:ENTREGADO");
    }
    private static boolean texto(String v) { return v!=null && !v.isBlank(); }
    private static void exigir(boolean condicion, String mensaje) { if(!condicion) throw new ConflictoEstadoException(mensaje); }
}
