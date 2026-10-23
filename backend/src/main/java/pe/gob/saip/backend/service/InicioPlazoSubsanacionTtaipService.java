package pe.gob.saip.backend.service;

import java.time.LocalDateTime;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

/** Records dated delivery evidence once, in the notification transaction; never infers historical efficacy. */
@Service
public class InicioPlazoSubsanacionTtaipService {
    private final InicioPlazoSubsanacionTtaipRepository inicios;
    private final ApelacionRepository apelaciones;
    private final EntityManager em;
    public InicioPlazoSubsanacionTtaipService(InicioPlazoSubsanacionTtaipRepository inicios,
            ApelacionRepository apelaciones, EntityManager em) {
        this.inicios=inicios; this.apelaciones=apelaciones; this.em=em;
    }
    @Transactional
    public void registrar(NotificacionTtaip n, LocalDateTime fechaExplicita, String fuente, String sustento) {
        if (fechaExplicita == null || sustento == null || sustento.isBlank() || n.getCedula() == null) return;
        Resolucion r=n.getCedula().getResolucion();
        if (r == null || r.getTipoResolucion()!=Resolucion.TipoResolucion.PRIMERA_CALIFICACION
                || r.getDecision()!=Resolucion.DecisionResolucion.INADMISIBLE
                || n.getDestinatario()!=CedulaNotificacion.DestinatarioNotificacion.CIUDADANO
                || n.getCedula().getDestinatario()!=CedulaNotificacion.DestinatarioNotificacion.CIUDADANO
                || r.getExpedienteTtaip()==null || n.getExpediente()==null
                || !r.getExpedienteTtaip().getId().equals(n.getExpediente().getId())
                || r.getApelacion().getCiudadano()==null) return;
        boolean acuse="ACUSE_ENTREGADO".equals(fuente) && "ENTREGADA".equals(n.getEstado())
                && "ENTREGADO".equals(n.getEstadoAcuse()) && n.getAcuseAutomatico()!=null && !n.getAcuseAutomatico().isBlank();
        boolean manual="VALIDACION_MANUAL".equals(fuente) && "VALIDADA".equals(n.getEstado())
                && Boolean.TRUE.equals(n.getValidadaManualmente());
        if (!acuse && !manual) return;
        String medio=n.getMedioNotificacion()==null ? n.getMedio() : n.getMedioNotificacion();
        if (acuse && medio!=null && medio.startsWith("CORREO")
                && (n.getConstanciaEnvio()==null || n.getConstanciaEnvio().isBlank())) return;
        if (fechaExplicita.isAfter(LocalDateTime.now()) || r.getFechaResolucion()==null
                || fechaExplicita.isBefore(r.getFechaResolucion()))
            throw new IllegalArgumentException("La fecha eficaz debe estar respaldada y comprendida entre la resolución y el momento actual");
        Apelacion ap=apelaciones.findByIdForUpdate(r.getApelacion().getId()).orElseThrow();
        em.refresh(ap, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (inicios.existsById(r.getId())) {
            // The new notification evidence/history remains recorded; it cannot reset an existing clock.
            n.setTrazabilidad((n.getTrazabilidad()==null ? "" : n.getTrazabilidad()+"\n")
                + LocalDateTime.now()+" - Inicio de subsanación existente conservado; nueva evidencia no rectifica la fecha eficaz.");
            return;
        }
        InicioPlazoSubsanacionTtaip inicio=new InicioPlazoSubsanacionTtaip();
        inicio.setRequerimiento(r); inicio.setNotificacion(n); inicio.setCiudadano(ap.getCiudadano());
        inicio.setFechaEficacia(fechaExplicita.truncatedTo(java.time.temporal.ChronoUnit.MICROS)); inicio.setDiasHabiles(ap.getDiasSubsanacion()==null ? 2 : ap.getDiasSubsanacion());
        inicio.setFuente(fuente); inicio.setSustento(sustento); inicio.setFechaRegistro(LocalDateTime.now());
        inicios.saveAndFlush(inicio); r.setInicioPlazoSubsanacion(inicio);
        n.setTrazabilidad((n.getTrazabilidad()==null ? "" : n.getTrazabilidad()+"\n")
            + LocalDateTime.now()+" - Inicio de subsanación fijado: requerimiento="+r.getId()+"; fuente="+fuente+"; fecha eficaz="+fechaExplicita);
    }
}
