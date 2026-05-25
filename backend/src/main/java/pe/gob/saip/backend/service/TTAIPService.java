package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.CalificacionRequest;
import pe.gob.saip.backend.model.dto.CancelarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.CerrarCumplimientoResolucionRequest;
import pe.gob.saip.backend.model.dto.CrearSeguimientoCumplimientoRequest;
import pe.gob.saip.backend.model.dto.CumplimientoResolucionTtaipDTO;
import pe.gob.saip.backend.model.dto.DescargoEntidadTtaipDTO;
import pe.gob.saip.backend.model.dto.ObservarCumplimientoResolucionRequest;
import pe.gob.saip.backend.model.dto.NotificacionTtaipDTO;
import pe.gob.saip.backend.model.dto.PresentarDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.RegistrarAcuseAutomaticoNotificacionRequest;
import pe.gob.saip.backend.model.dto.RegistrarConstanciaEnvioNotificacionRequest;
import pe.gob.saip.backend.model.dto.RegistrarCumplimientoResolucionRequest;
import pe.gob.saip.backend.model.dto.RegistrarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.ReprocesarNotificacionRequest;
import pe.gob.saip.backend.model.dto.ReprocesoNotificacionDTO;
import pe.gob.saip.backend.model.dto.RequerirDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.ResolucionRequest;
import pe.gob.saip.backend.model.dto.SuspensionPlazoTtaipDTO;
import pe.gob.saip.backend.model.dto.ValidarNotificacionManualRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;
import pe.gob.saip.backend.model.entity.MiembroTTAIP;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TTAIPService {

    private final ApelacionService apelacionService;
    private final ResolucionService resolucionService;
    private final MiembroTTAIPService miembroTTAIPService;
    private final ExpedienteTtaipService expedienteTtaipService;

    public TTAIPService(ApelacionService apelacionService,
                        ResolucionService resolucionService,
                        MiembroTTAIPService miembroTTAIPService,
                        ExpedienteTtaipService expedienteTtaipService) {
        this.apelacionService = apelacionService;
        this.resolucionService = resolucionService;
        this.miembroTTAIPService = miembroTTAIPService;
        this.expedienteTtaipService = expedienteTtaipService;
    }

    // ============================================================
    // CONSULTAS
    // ============================================================

    @Transactional(readOnly = true)
    public Map<String, Object> obtenerEstadisticas() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("total", apelacionService.count());
        stats.put("pendientesAdmision",
                apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1)
                + apelacionService.contarApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION));
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
        return listarPrimeraCalificacion();
    }

    @Transactional(readOnly = true)
    public List<ApelacionDTO> listarPrimeraCalificacion() {
        List<Apelacion> apelaciones = new ArrayList<>();
        apelaciones.addAll(apelacionService.obtenerApelacionesPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1));
        apelaciones.addAll(apelacionService.obtenerApelacionesPorEstado(Apelacion.EstadoApelacion.PENDIENTE_ELEVACION));

        return apelaciones.stream()
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
        guardarResolucionConDocumentos(resolucion);
        if (esSegundaCalificacion) {
            apelacion.setEstado(Apelacion.EstadoApelacion.NOTIFICACION_SEGUNDA_CALIFICACION);
            apelacion.setCalificacionSegunda(Apelacion.Calificacion.ADMITIDO);
        } else {
            apelacion.setEstado(Apelacion.EstadoApelacion.EN_RESOLUCION);
            apelacion.setCalificacionPrimera(Apelacion.Calificacion.ADMISIBLE);
        }
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION);
        apelacion.setCalificacionPrimera(Apelacion.Calificacion.INADMISIBLE);
        apelacion.setFechaSubsanacion(LocalDate.now());
        apelacion.setDiasSubsanacion(diasSubsanacion);
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        if (esSegundaCalificacion) {
            apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
            apelacion.setCalificacionSegunda(Apelacion.Calificacion.IMPROCEDENTE);
        } else {
            apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
            apelacion.setCalificacionPrimera(Apelacion.Calificacion.IMPROCEDENTE);
        }
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO);
        apelacion.setResultado("FUNDADO");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO);
        apelacion.setResultado("INFUNDADO");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE);
        apelacion.setResultado("FUNDADO_EN_PARTE");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE);
        apelacion.setResultado("INFUNDADO_EN_PARTE");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE);
        apelacion.setResultado("IMPROCEDENTE");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA);
        apelacion.setResultado("CONCLUSION_SUSTRACCION_MATERIA");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.CONCLUSION_DESISTIMIENTO);
        apelacion.setResultado("CONCLUSION_DESISTIMIENTO");
        guardarApelacionConExpediente(apelacion);
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
        guardarResolucionConDocumentos(resolucion);
        apelacion.setEstado(Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO);
        apelacion.setResultado("TENER_POR_NO_PRESENTADO");
        guardarApelacionConExpediente(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ApelacionDTO notificarSegundaCalificacion(Long apelacionId) {
        Apelacion apelacion = buscarApelacion(apelacionId);
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_RESOLUCION);
        guardarApelacionConExpediente(apelacion);
        return ApelacionDTO.from(apelacion);
    }

    @Transactional
    public ReprocesoNotificacionDTO reprocesarNotificacionFallida(ReprocesarNotificacionRequest request) {
        CedulaNotificacion.DestinatarioNotificacion destinatario = parseDestinatario(request.destinatario());
        return ReprocesoNotificacionDTO.from(expedienteTtaipService.reprocesarNotificacionFallida(
                request.numeroCedulaOriginal(),
                destinatario,
                request.observacion(),
                request.responsable()
        ));
    }

    @Transactional(readOnly = true)
    public List<NotificacionTtaipDTO> listarNotificaciones(Long expedienteId) {
        return expedienteTtaipService.listarNotificaciones(expedienteId)
                .stream()
                .map(NotificacionTtaipDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public NotificacionTtaipDTO obtenerNotificacion(Long expedienteId, Long notificacionId) {
        return NotificacionTtaipDTO.from(expedienteTtaipService.obtenerNotificacion(expedienteId, notificacionId));
    }

    @Transactional
    public NotificacionTtaipDTO registrarConstanciaEnvio(Long expedienteId,
                                                         Long notificacionId,
                                                         RegistrarConstanciaEnvioNotificacionRequest request) {
        return NotificacionTtaipDTO.from(
                expedienteTtaipService.registrarConstanciaEnvio(expedienteId, notificacionId, request));
    }

    @Transactional
    public NotificacionTtaipDTO registrarAcuseAutomatico(Long expedienteId,
                                                         Long notificacionId,
                                                         RegistrarAcuseAutomaticoNotificacionRequest request) {
        return NotificacionTtaipDTO.from(
                expedienteTtaipService.registrarAcuseAutomatico(expedienteId, notificacionId, request));
    }

    @Transactional
    public NotificacionTtaipDTO validarNotificacionManualmente(Long expedienteId,
                                                               Long notificacionId,
                                                               ValidarNotificacionManualRequest request) {
        return NotificacionTtaipDTO.from(
                expedienteTtaipService.validarNotificacionManualmente(expedienteId, notificacionId, request));
    }

    @Transactional
    public DescargoEntidadTtaipDTO requerirDescargos(Long expedienteId, RequerirDescargoEntidadRequest request) {
        return DescargoEntidadTtaipDTO.from(expedienteTtaipService.requerirDescargos(expedienteId, request));
    }

    @Transactional(readOnly = true)
    public List<DescargoEntidadTtaipDTO> listarDescargos(Long expedienteId) {
        return expedienteTtaipService.listarDescargos(expedienteId)
                .stream()
                .map(DescargoEntidadTtaipDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DescargoEntidadTtaipDTO obtenerDescargoActivo(Long expedienteId) {
        return DescargoEntidadTtaipDTO.from(expedienteTtaipService.obtenerDescargoActivo(expedienteId));
    }

    @Transactional
    public DescargoEntidadTtaipDTO presentarDescargo(Long expedienteId,
                                                     Long descargoId,
                                                     PresentarDescargoEntidadRequest request) {
        return DescargoEntidadTtaipDTO.from(expedienteTtaipService.presentarDescargo(expedienteId, descargoId, request));
    }

    @Transactional
    public List<DescargoEntidadTtaipDTO> procesarDescargosVencidos() {
        return expedienteTtaipService.procesarDescargosVencidos()
                .stream()
                .map(DescargoEntidadTtaipDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SuspensionPlazoTtaipDTO> listarSuspensiones(Long expedienteId) {
        return expedienteTtaipService.listarSuspensiones(expedienteId)
                .stream()
                .map(SuspensionPlazoTtaipDTO::from)
                .toList();
    }

    @Transactional
    public SuspensionPlazoTtaipDTO registrarInformeOral(Long expedienteId, RegistrarSuspensionTtaipRequest request) {
        return SuspensionPlazoTtaipDTO.from(
                expedienteTtaipService.registrarSuspensionPorInformeOral(expedienteId, request));
    }

    @Transactional
    public SuspensionPlazoTtaipDTO registrarInformacionComplementaria(Long expedienteId,
                                                                      RegistrarSuspensionTtaipRequest request) {
        return SuspensionPlazoTtaipDTO.from(
                expedienteTtaipService.registrarSuspensionPorInformacionComplementaria(expedienteId, request));
    }

    @Transactional
    public SuspensionPlazoTtaipDTO cancelarSuspension(Long expedienteId,
                                                     Long suspensionId,
                                                     CancelarSuspensionTtaipRequest request) {
        return SuspensionPlazoTtaipDTO.from(
                expedienteTtaipService.cancelarSuspension(expedienteId, suspensionId, request));
    }

    @Transactional
    public CumplimientoResolucionTtaipDTO crearSeguimientoCumplimiento(Long expedienteId,
                                                                       Long resolucionId,
                                                                       CrearSeguimientoCumplimientoRequest request) {
        return CumplimientoResolucionTtaipDTO.from(
                expedienteTtaipService.crearSeguimientoCumplimiento(expedienteId, resolucionId, request));
    }

    @Transactional(readOnly = true)
    public List<CumplimientoResolucionTtaipDTO> listarCumplimientos(Long expedienteId) {
        return expedienteTtaipService.listarCumplimientos(expedienteId)
                .stream()
                .map(CumplimientoResolucionTtaipDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CumplimientoResolucionTtaipDTO obtenerCumplimientoActivo(Long expedienteId) {
        return CumplimientoResolucionTtaipDTO.from(expedienteTtaipService.obtenerCumplimientoActivo(expedienteId));
    }

    @Transactional
    public CumplimientoResolucionTtaipDTO registrarCumplimiento(Long expedienteId,
                                                                Long cumplimientoId,
                                                                RegistrarCumplimientoResolucionRequest request) {
        return CumplimientoResolucionTtaipDTO.from(
                expedienteTtaipService.registrarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Transactional
    public CumplimientoResolucionTtaipDTO observarCumplimiento(Long expedienteId,
                                                               Long cumplimientoId,
                                                               ObservarCumplimientoResolucionRequest request) {
        return CumplimientoResolucionTtaipDTO.from(
                expedienteTtaipService.observarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Transactional
    public CumplimientoResolucionTtaipDTO cerrarCumplimiento(Long expedienteId,
                                                             Long cumplimientoId,
                                                             CerrarCumplimientoResolucionRequest request) {
        return CumplimientoResolucionTtaipDTO.from(
                expedienteTtaipService.cerrarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Transactional
    public List<CumplimientoResolucionTtaipDTO> procesarCumplimientosVencidos() {
        return expedienteTtaipService.procesarCumplimientosVencidos()
                .stream()
                .map(CumplimientoResolucionTtaipDTO::from)
                .toList();
    }

    // ============================================================
    // HELPERS INTERNOS
    // ============================================================

    private Apelacion buscarApelacion(Long apelacionId) {
        return apelacionService.findById(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Apelación no encontrada con ID: " + apelacionId));
    }

    private CedulaNotificacion.DestinatarioNotificacion parseDestinatario(String destinatario) {
        try {
            return CedulaNotificacion.DestinatarioNotificacion.valueOf(destinatario.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new IllegalArgumentException(
                    "Destinatario de notificación no válido: " + destinatario
                    + ". Valores permitidos: CIUDADANO, ENTIDAD_PUBLICA");
        }
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
        return expedienteTtaipService.prepararResolucion(resolucion);
    }

    private void guardarResolucionConDocumentos(Resolucion resolucion) {
        resolucionService.save(resolucion);
        expedienteTtaipService.registrarResolucion(resolucion);
    }

    private void guardarApelacionConExpediente(Apelacion apelacion) {
        Apelacion saved = apelacionService.save(apelacion);
        expedienteTtaipService.obtenerOCrearParaApelacion(saved);
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
