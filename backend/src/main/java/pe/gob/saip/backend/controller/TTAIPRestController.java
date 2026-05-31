package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.ApelacionDTO;
import pe.gob.saip.backend.model.dto.CalificacionRequest;
import pe.gob.saip.backend.model.dto.CancelarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.dto.CerrarCumplimientoResolucionRequest;
import pe.gob.saip.backend.model.dto.CrearSeguimientoCumplimientoRequest;
import pe.gob.saip.backend.model.dto.CumplimientoResolucionTtaipDTO;
import pe.gob.saip.backend.model.dto.DescargoEntidadTtaipDTO;
import pe.gob.saip.backend.model.dto.NotificacionTtaipDTO;
import pe.gob.saip.backend.model.dto.ObservarCumplimientoResolucionRequest;
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
import pe.gob.saip.backend.service.TTAIPService;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.dto.IntentoNotificacionDTO;
import pe.gob.saip.backend.model.entity.IntentoNotificacion;
import pe.gob.saip.backend.service.MotorNotificacionesService;
import java.util.stream.Collectors;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ttaip")
@Validated
@Tag(name = "TTAIP", description = "Calificación y resolución de apelaciones por el Tribunal de Transparencia")
public class TTAIPRestController {

    private final TTAIPService ttaipService;
    private final MotorNotificacionesService motorNotificacionesService;

    public TTAIPRestController(TTAIPService ttaipService,
                               MotorNotificacionesService motorNotificacionesService) {
        this.ttaipService = ttaipService;
        this.motorNotificacionesService = motorNotificacionesService;
    }

    @Operation(summary = "Estadísticas del tribunal")
    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticas() {
        return ResponseEntity.ok(ttaipService.obtenerEstadisticas());
    }

    @Operation(summary = "Listar apelaciones en primera calificación")
    @GetMapping("/pendientes")
    public ResponseEntity<List<ApelacionDTO>> listarPendientes() {
        return ResponseEntity.ok(ttaipService.listarPendientes());
    }

    @Operation(summary = "Listar apelaciones en primera calificación")
    @GetMapping("/en-calificacion")
    public ResponseEntity<List<ApelacionDTO>> listarEnCalificacion() {
        return ResponseEntity.ok(ttaipService.listarPrimeraCalificacion());
    }

    @Operation(summary = "Listar apelaciones en subsanación")
    @GetMapping("/subsanacion")
    public ResponseEntity<List<ApelacionDTO>> listarSubsanacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_SUBSANACION));
    }

    @Operation(summary = "Listar apelaciones en segunda calificación")
    @GetMapping("/segunda-calificacion")
    public ResponseEntity<List<ApelacionDTO>> listarSegundaCalificacion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_2));
    }

    @Operation(summary = "Listar apelaciones en resolución", description = "Apelaciones admitidas pendientes de resolución final")
    @GetMapping("/en-resolucion")
    public ResponseEntity<List<ApelacionDTO>> listarEnResolucion() {
        return ResponseEntity.ok(ttaipService.listarPorEstado(Apelacion.EstadoApelacion.EN_RESOLUCION));
    }

    @Operation(summary = "Listar apelaciones resueltas")
    @GetMapping("/resueltas")
    public ResponseEntity<List<ApelacionDTO>> listarResueltas() {
        return ResponseEntity.ok(ttaipService.listarResueltas());
    }

    @Operation(summary = "Admitir apelación", description = "Primera calificación: admite la apelación y solicita descargos a la entidad")
    @PostMapping("/calificacion/{apelacionId}/admitir")
    public ResponseEntity<ApelacionDTO> admitirApelacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.admitirApelacion(apelacionId, request));
    }

    @Operation(summary = "Requerir subsanación", description = "Primera calificación: solicita al ciudadano subsanar la apelación en 2 días hábiles")
    @PostMapping("/calificacion/{apelacionId}/subsanar")
    public ResponseEntity<ApelacionDTO> requerirSubsanacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.requerirSubsanacion(apelacionId, request));
    }

    @Operation(summary = "Inadmitir o rechazar apelación")
    @PostMapping({"/calificacion/{apelacionId}/inadmitir", "/calificacion/{apelacionId}/rechazar"})
    public ResponseEntity<ApelacionDTO> inadmitirApelacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.inadmitirApelacion(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación fundada", description = "Resolución final a favor del ciudadano")
    @PostMapping({"/resolucion/{apelacionId}/fundado", "/resolucion/{apelacionId}/fundada"})
    public ResponseEntity<ApelacionDTO> declararFundado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararFundado(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación infundada", description = "Resolución final: confirma la denegación de la entidad")
    @PostMapping({"/resolucion/{apelacionId}/infundado", "/resolucion/{apelacionId}/infundada"})
    public ResponseEntity<ApelacionDTO> declararInfundado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararInfundado(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación fundada en parte", description = "Resolución final: amparo parcial del recurso")
    @PostMapping("/resolucion/{apelacionId}/fundado-en-parte")
    public ResponseEntity<ApelacionDTO> declararFundadoEnParte(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararFundadoEnParte(apelacionId, request));
    }

    @Operation(summary = "Declarar apelación infundada en parte", description = "Resolución final: desestimación parcial del recurso")
    @PostMapping("/resolucion/{apelacionId}/infundado-en-parte")
    public ResponseEntity<ApelacionDTO> declararInfundadoEnParte(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararInfundadoEnParte(apelacionId, request));
    }

    @Operation(summary = "Declarar improcedente en resolución final", description = "Resolución final: no cumple requisitos formales o de fondo")
    @PostMapping("/resolucion/{apelacionId}/improcedente")
    public ResponseEntity<ApelacionDTO> declararImprocedenteFinal(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararImprocedenteFinal(apelacionId, request));
    }

    @Operation(summary = "Conclusión por sustracción de la materia", description = "La entidad entrega la información durante el trámite de apelación")
    @PostMapping("/resolucion/{apelacionId}/sustraccion-materia")
    public ResponseEntity<ApelacionDTO> declararConclusionSustraccion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararConclusionSustraccion(apelacionId, request));
    }

    @Operation(summary = "Conclusión por desistimiento", description = "El ciudadano desiste voluntariamente del recurso")
    @PostMapping("/resolucion/{apelacionId}/desistimiento")
    public ResponseEntity<ApelacionDTO> declararConclusionDesistimiento(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararConclusionDesistimiento(apelacionId, request));
    }

    @Operation(
            summary = "Declarar estese a lo resuelto",
            description = "Resolución final: existe pronunciamiento previo aplicable al mismo asunto o pedido reiterado"
    )
    @PostMapping("/resolucion/{apelacionId}/estese-a-lo-resuelto")
    public ResponseEntity<ApelacionDTO> declararEsteseALoResuelto(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararEsteseALoResuelto(apelacionId, request));
    }

    @Operation(
            summary = "Declarar nulidad del acto",
            description = "Resolución final: invalida la respuesta o procedimiento por vicios graves"
    )
    @PostMapping("/resolucion/{apelacionId}/nulidad-acto")
    public ResponseEntity<ApelacionDTO> declararNulidadDelActo(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody ResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.declararNulidadDelActo(apelacionId, request));
    }

    @Operation(summary = "Declarar tener por no presentado", description = "El ciudadano no subsanó en plazo de 2 días hábiles tras inadmisible")
    @PostMapping("/calificacion/{apelacionId}/no-presentado")
    public ResponseEntity<ApelacionDTO> declararTenerPorNoPresentado(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId,
            @Valid @RequestBody CalificacionRequest request) {
        return ResponseEntity.ok(ttaipService.declararTenerPorNoPresentado(apelacionId, request));
    }

    @Operation(summary = "Notificar segunda calificación al ciudadano", description = "Registra la notificación de la resolución de segunda calificación. Inicia el plazo de resolución final.")
    @PostMapping("/{apelacionId}/notificar-segunda-calificacion")
    public ResponseEntity<ApelacionDTO> notificarSegundaCalificacion(
            @Parameter(description = "ID de la apelación") @PathVariable Long apelacionId) {
        return ResponseEntity.ok(ttaipService.notificarSegundaCalificacion(apelacionId));
    }

    @Operation(
            summary = "Reprocesar notificación TTAIP fallida",
            description = "Registra una falla de notificación y genera una nueva cédula para el mismo destinatario afectado, sin borrar la cédula original."
    )
    @PostMapping("/notificaciones/reprocesar")
    public ResponseEntity<ReprocesoNotificacionDTO> reprocesarNotificacion(
            @Valid @RequestBody ReprocesarNotificacionRequest request) {
        return ResponseEntity.ok(ttaipService.reprocesarNotificacionFallida(request));
    }

    @Operation(summary = "Listar notificaciones de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/notificaciones")
    public ResponseEntity<List<NotificacionTtaipDTO>> listarNotificaciones(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.listarNotificaciones(expedienteId));
    }

    @Operation(summary = "Consultar notificación TTAIP con evidencia")
    @GetMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}")
    public ResponseEntity<NotificacionTtaipDTO> obtenerNotificacion(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId) {
        return ResponseEntity.ok(ttaipService.obtenerNotificacion(expedienteId, notificacionId));
    }

    @Operation(
            summary = "Registrar constancia de envío",
            description = "Registra evidencia operativa de envío de la notificación sin integrar todavía un proveedor externo."
    )
    @PostMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}/constancia-envio")
    public ResponseEntity<NotificacionTtaipDTO> registrarConstanciaEnvio(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId,
            @Valid @RequestBody RegistrarConstanciaEnvioNotificacionRequest request) {
        return ResponseEntity.ok(ttaipService.registrarConstanciaEnvio(expedienteId, notificacionId, request));
    }

    @Operation(
            summary = "Registrar acuse automático",
            description = "Registra acuse automático de la notificación. Si el acuse falla, la notificación queda fallida u observada y puede reprocesarse."
    )
    @PostMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}/acuse-automatico")
    public ResponseEntity<NotificacionTtaipDTO> registrarAcuseAutomatico(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId,
            @Valid @RequestBody RegistrarAcuseAutomaticoNotificacionRequest request) {
        return ResponseEntity.ok(ttaipService.registrarAcuseAutomatico(expedienteId, notificacionId, request));
    }

    @Operation(
            summary = "Validar manualmente una notificación",
            description = "Permite validación manual de notificación correcta cuando el flujo dependa de una notificación válida."
    )
    @PostMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}/validacion-manual")
    public ResponseEntity<NotificacionTtaipDTO> validarNotificacionManualmente(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId,
            @Valid @RequestBody ValidarNotificacionManualRequest request) {
        return ResponseEntity.ok(ttaipService.validarNotificacionManualmente(expedienteId, notificacionId, request));
    }

    @Operation(
            summary = "Requerir descargos de entidad",
            description = "Registra el requerimiento de descargos y expediente administrativo a la entidad pública. Suspende el plazo de resolución final por 7 días hábiles."
    )
    @PostMapping("/expedientes/{expedienteId}/descargos/requerir")
    public ResponseEntity<DescargoEntidadTtaipDTO> requerirDescargos(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Valid @RequestBody RequerirDescargoEntidadRequest request) {
        return ResponseEntity.ok(ttaipService.requerirDescargos(expedienteId, request));
    }

    @Operation(summary = "Listar descargos de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/descargos")
    public ResponseEntity<List<DescargoEntidadTtaipDTO>> listarDescargos(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.listarDescargos(expedienteId));
    }

    @Operation(summary = "Obtener descargo activo de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/descargos/activo")
    public ResponseEntity<DescargoEntidadTtaipDTO> obtenerDescargoActivo(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.obtenerDescargoActivo(expedienteId));
    }

    @Operation(
            summary = "Presentar descargo de entidad",
            description = "Registra el descargo y/o expediente administrativo de la entidad pública, cierra la suspensión y recalcula el plazo de resolución."
    )
    @PostMapping("/expedientes/{expedienteId}/descargos/{descargoId}/presentar")
    public ResponseEntity<DescargoEntidadTtaipDTO> presentarDescargo(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID del requerimiento de descargo") @PathVariable Long descargoId,
            @Valid @RequestBody PresentarDescargoEntidadRequest request) {
        return ResponseEntity.ok(ttaipService.presentarDescargo(expedienteId, descargoId, request));
    }

    @Operation(summary = "Procesar descargos vencidos")
    @PostMapping("/descargos/vencidos/procesar")
    public ResponseEntity<List<DescargoEntidadTtaipDTO>> procesarDescargosVencidos() {
        return ResponseEntity.ok(ttaipService.procesarDescargosVencidos());
    }

    @Operation(summary = "Listar suspensiones de plazo de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/suspensiones")
    public ResponseEntity<List<SuspensionPlazoTtaipDTO>> listarSuspensiones(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.listarSuspensiones(expedienteId));
    }

    @Operation(
            summary = "Registrar informe oral",
            description = "Registra una suspensión adicional de 3 días hábiles por solicitud de informe oral dentro de un expediente TTAIP en resolución."
    )
    @PostMapping("/expedientes/{expedienteId}/suspensiones/informe-oral")
    public ResponseEntity<SuspensionPlazoTtaipDTO> registrarInformeOral(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Valid @RequestBody RegistrarSuspensionTtaipRequest request) {
        return ResponseEntity.ok(ttaipService.registrarInformeOral(expedienteId, request));
    }

    @Operation(
            summary = "Registrar información complementaria",
            description = "Registra una suspensión adicional de 3 días hábiles por solicitud de información complementaria dentro de un expediente TTAIP en resolución."
    )
    @PostMapping("/expedientes/{expedienteId}/suspensiones/informacion-complementaria")
    public ResponseEntity<SuspensionPlazoTtaipDTO> registrarInformacionComplementaria(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Valid @RequestBody RegistrarSuspensionTtaipRequest request) {
        return ResponseEntity.ok(ttaipService.registrarInformacionComplementaria(expedienteId, request));
    }

    @Operation(
            summary = "Cancelar suspensión de plazo",
            description = "Cancela una suspensión adicional activa y recalcula la fecha límite de resolución final."
    )
    @PatchMapping("/expedientes/{expedienteId}/suspensiones/{suspensionId}/cancelar")
    public ResponseEntity<SuspensionPlazoTtaipDTO> cancelarSuspension(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la suspensión") @PathVariable Long suspensionId,
            @Valid @RequestBody CancelarSuspensionTtaipRequest request) {
        return ResponseEntity.ok(ttaipService.cancelarSuspension(expedienteId, suspensionId, request));
    }

    @Operation(
            summary = "Crear seguimiento de cumplimiento de resolución fundada",
            description = "Abre seguimiento para que la entidad cumpla una resolución final FUNDADO o FUNDADO_EN_PARTE en 7 días hábiles."
    )
    @PostMapping("/expedientes/{expedienteId}/resoluciones/{resolucionId}/cumplimientos")
    public ResponseEntity<CumplimientoResolucionTtaipDTO> crearSeguimientoCumplimiento(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la resolución final") @PathVariable Long resolucionId,
            @Valid @RequestBody CrearSeguimientoCumplimientoRequest request) {
        return ResponseEntity.ok(ttaipService.crearSeguimientoCumplimiento(expedienteId, resolucionId, request));
    }

    @Operation(summary = "Listar cumplimientos de resolución de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/cumplimientos")
    public ResponseEntity<List<CumplimientoResolucionTtaipDTO>> listarCumplimientos(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.listarCumplimientos(expedienteId));
    }

    @Operation(summary = "Consultar cumplimiento activo de un expediente TTAIP")
    @GetMapping("/expedientes/{expedienteId}/cumplimientos/activo")
    public ResponseEntity<CumplimientoResolucionTtaipDTO> obtenerCumplimientoActivo(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId) {
        return ResponseEntity.ok(ttaipService.obtenerCumplimientoActivo(expedienteId));
    }

    @Operation(summary = "Registrar cumplimiento comunicado por entidad pública")
    @PostMapping("/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/registrar")
    public ResponseEntity<CumplimientoResolucionTtaipDTO> registrarCumplimiento(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID del seguimiento de cumplimiento") @PathVariable Long cumplimientoId,
            @Valid @RequestBody RegistrarCumplimientoResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.registrarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Operation(summary = "Observar cumplimiento de resolución")
    @PatchMapping("/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/observar")
    public ResponseEntity<CumplimientoResolucionTtaipDTO> observarCumplimiento(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID del seguimiento de cumplimiento") @PathVariable Long cumplimientoId,
            @Valid @RequestBody ObservarCumplimientoResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.observarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Operation(summary = "Cerrar seguimiento de cumplimiento de resolución")
    @PatchMapping("/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/cerrar")
    public ResponseEntity<CumplimientoResolucionTtaipDTO> cerrarCumplimiento(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID del seguimiento de cumplimiento") @PathVariable Long cumplimientoId,
            @Valid @RequestBody CerrarCumplimientoResolucionRequest request) {
        return ResponseEntity.ok(ttaipService.cerrarCumplimiento(expedienteId, cumplimientoId, request));
    }

    @Operation(summary = "Procesar cumplimientos vencidos")
    @PostMapping("/cumplimientos/vencidos/procesar")
    public ResponseEntity<List<CumplimientoResolucionTtaipDTO>> procesarCumplimientosVencidos() {
        return ResponseEntity.ok(ttaipService.procesarCumplimientosVencidos());
    }

    @Operation(summary = "Enviar notificación para expediente TTAIP")
    @PostMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}/enviar")
    public ResponseEntity<IntentoNotificacionDTO> enviarNotificacion(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId,
            @Valid @RequestBody EnviarNotificacionRequest request) {
        IntentoNotificacion intento = motorNotificacionesService.enviarNotificacionTtaip(expedienteId, notificacionId, request);
        return ResponseEntity.status(201).body(IntentoNotificacionDTO.from(intento));
    }

    @Operation(summary = "Listar intentos de notificación de una notificación TTAIP")
    @GetMapping("/expedientes/{expedienteId}/notificaciones/{notificacionId}/intentos")
    public ResponseEntity<List<IntentoNotificacionDTO>> listarIntentos(
            @Parameter(description = "ID del expediente TTAIP") @PathVariable Long expedienteId,
            @Parameter(description = "ID de la notificación") @PathVariable Long notificacionId) {
        List<IntentoNotificacionDTO> intentos = motorNotificacionesService.listarIntentosTtaip(expedienteId, notificacionId)
                .stream()
                .map(IntentoNotificacionDTO::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(intentos);
    }
}

