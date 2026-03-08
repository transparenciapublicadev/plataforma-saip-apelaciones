package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.CalificacionRequest;
import pe.gob.saip.backend.model.dto.ResolucionRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TTAIPService {

    private final ApelacionService apelacionService;
    private final ResolucionService resolucionService;
    private final MiembroTTAIPService miembroTTAIPService;

    public TTAIPService(ApelacionService apelacionService,
                        ResolucionService resolucionService,
                        MiembroTTAIPService miembroTTAIPService) {
        this.apelacionService = apelacionService;
        this.resolucionService = resolucionService;
        this.miembroTTAIPService = miembroTTAIPService;
    }

    // ============================================================
    // CONSULTAS
    // ============================================================

    @Transactional(readOnly = true)
    public Map<String, Object> obtenerEstadisticas() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", apelacionService.count());
        stats.put("pendientesAdmision",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1));
        stats.put("enProceso",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_RESOLUCION));
        stats.put("enSubsanacion", apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
        stats.put("resueltas",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.RESUELTO)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.CONCLUSION_DESISTIMIENTO));
        return stats;
    }

    @Transactional(readOnly = true)
    public List<ApelacionDTO> listarPendientes() {
        return apelacionService.findPendientes().stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ApelacionDTO> listarPorEstado(Apelacion.EstadoApelacion estado) {
        return apelacionService.obtenerApelacionesPorEstado(estado)
                .stream()
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ApelacionDTO> listarResueltas() {
        return apelacionService.findAll().stream()
                .filter(Apelacion::isResuelta)
                .map(ApelacionDTO::from)
                .collect(Collectors.toList());
    }

    // ============================================================
    // CALIFICACIÓN — Lógica de dominio (BR-TTAIP-002)
    // ============================================================

    @Transactional
    public ApelacionDTO admitirApelacion(Long apelacionId, CalificacionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        boolean esSegundaCalificacion = apelacion.getEstado() == Apelacion.EstadoApelacion.EN_CALIFICACION_2;
        Resolucion resolucion = crearResolucion(
                apelacion,
                esSegundaCalificacion ? Resolucion.TipoResolucion.SEGUNDA_CALIFICACION : Resolucion.TipoResolucion.PRIMERA_CALIFICACION,
                esSegundaCalificacion ? Resolucion.DecisionResolucion.ADMITIDO : Resolucion.DecisionResolucion.ADMISIBLE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setObservaciones(request.observaciones());
        resolucionService.save(resolucion);
        if (esSegundaCalificacion) {
            apelacion.setEstado(Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION);
            apelacion.setCalificacionSegunda(Apelacion.Calificacion.ADMITIDO);
        } else {
            apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2);
            apelacion.setCalificacionPrimera(Apelacion.Calificacion.ADMISIBLE);
        }
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO requerirSubsanacion(Long apelacionId, CalificacionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        int diasSubsanacion = request.diasSubsanacion() != null ? request.diasSubsanacion() : 2;
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.PRIMERA_CALIFICACION,
                Resolucion.DecisionResolucion.INADMISIBLE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setObservaciones(request.observaciones());
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION);
        apelacion.setCalificacionPrimera(Apelacion.Calificacion.INADMISIBLE);
        apelacion.setFechaSubsanacion(LocalDate.now());
        apelacion.setDiasSubsanacion(diasSubsanacion);
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO inadmitirApelacion(Long apelacionId, CalificacionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        boolean esSegundaCalificacion = apelacion.getEstado() == Apelacion.EstadoApelacion.EN_CALIFICACION_2;
        Resolucion resolucion = crearResolucion(
                apelacion,
                esSegundaCalificacion ? Resolucion.TipoResolucion.SEGUNDA_CALIFICACION : Resolucion.TipoResolucion.PRIMERA_CALIFICACION,
                Resolucion.DecisionResolucion.IMPROCEDENTE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucionService.save(resolucion);
        if (esSegundaCalificacion) {
            apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
            apelacion.setCalificacionSegunda(Apelacion.Calificacion.IMPROCEDENTE);
        } else {
            apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
            apelacion.setCalificacionPrimera(Apelacion.Calificacion.IMPROCEDENTE);
        }
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    // ============================================================
    // RESOLUCIÓN FINAL — Lógica de dominio (BR-TTAIP-009)
    // ============================================================

    @Transactional
    public ApelacionDTO declararFundado(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.FUNDADO,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("FUNDADO");
        resolucion.setIniciarProcesoDisciplinario(request.iniciarProcesoDisciplinario());
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);
        apelacion.setResultado("FUNDADO");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararInfundado(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.INFUNDADO,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("INFUNDADO");
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO);
        apelacion.setResultado("INFUNDADO");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararFundadoEnParte(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.FUNDADO_EN_PARTE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("FUNDADO_EN_PARTE");
        resolucion.setIniciarProcesoDisciplinario(request.iniciarProcesoDisciplinario());
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE);
        apelacion.setResultado("FUNDADO_EN_PARTE");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararInfundadoEnParte(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.INFUNDADO_EN_PARTE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("INFUNDADO_EN_PARTE");
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE);
        apelacion.setResultado("INFUNDADO_EN_PARTE");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararImprocedenteFinal(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.IMPROCEDENTE,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("IMPROCEDENTE");
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
        apelacion.setResultado("IMPROCEDENTE");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararConclusionSustraccion(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.CONCLUSION_SUSTRACCION_MATERIA,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("CONCLUSION_SUSTRACCION_MATERIA");
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA);
        apelacion.setResultado("CONCLUSION_SUSTRACCION_MATERIA");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararConclusionDesistimiento(Long apelacionId, ResolucionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.RESOLUCION_FINAL,
                Resolucion.DecisionResolucion.CONCLUSION_DESISTIMIENTO,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setResultado("CONCLUSION_DESISTIMIENTO");
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.CONCLUSION_DESISTIMIENTO);
        apelacion.setResultado("CONCLUSION_DESISTIMIENTO");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO declararTenerPorNoPresentado(Long apelacionId, CalificacionRequest request) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        Resolucion resolucion = crearResolucion(
                apelacion,
                Resolucion.TipoResolucion.PRIMERA_CALIFICACION,
                Resolucion.DecisionResolucion.TENER_POR_NO_PRESENTADO,
                request.fundamentos(),
                request.miembroId()
        );
        resolucion.setObservaciones(request.observaciones());
        resolucionService.save(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO);
        apelacion.setResultado("TENER_POR_NO_PRESENTADO");
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO notificarSegundaCalificacion(Long apelacionId) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_RESOLUCION);
        apelacionService.save(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    // ============================================================
    // HELPERS INTERNOS
    // ============================================================

    private Apelacion buscarApelacion(Long apelacionId) {
        return apelacionService.findById(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + apelacionId));
    }

    private Resolucion crearResolucion(Apelacion apelacion,
                                       Resolucion.TipoResolucion tipo,
                                       Resolucion.DecisionResolucion decision,
                                       String fundamentos,
                                       Long miembroId) {
        Resolucion resolucion = new Resolucion();
        resolucion.setApelacion(apelacion);
        resolucion.setTipoResolucion(tipo);
        resolucion.setDecision(decision);
        resolucion.setFundamentos(fundamentos);
        resolucion.setFechaResolucion(LocalDateTime.now());
        asignarMiembro(resolucion, miembroId);
        return resolucion;
    }

    private void asignarMiembro(Resolucion resolucion, Long miembroId) {
        if (miembroId != null) {
            miembroTTAIPService.obtenerMiembroTTAIPPorId(miembroId)
                    .ifPresent(resolucion::setMiembroTTAIP);
        } else {
            List<MiembroTTAIP> miembros = miembroTTAIPService.obtenerMiembrosTTAIPActivos();
            if (!miembros.isEmpty()) {
                resolucion.setMiembroTTAIP(miembros.get(0));
            }
        }
    }
}
