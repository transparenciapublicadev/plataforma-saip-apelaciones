package pe.gob.saip.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.service.MotorNotificacionesService;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlazoAlertaScheduler {

    private final MotorNotificacionesService motorNotificacionesService;
    private final pe.gob.saip.backend.service.SolicitudService solicitudService;
    private final pe.gob.saip.backend.service.SubsanacionTtaipService subsanacionTtaipService;

    /**
     * Tarea programada para ejecutarse todas las mañanas a las 6:00 AM.
     * Realiza una auditoría de plazos y transiciona las solicitudes vencidas.
     */
    @Scheduled(cron = "0 0 6 * * ?")
    public void procesarAuditoriaDePlazos() {
        // The domain command locks and rechecks the stored deadline (including extensions).
        List<Solicitud> vencidas = solicitudService.detectarSilencioAdministrativo();
        for (Solicitud solicitud : vencidas) {
            try {
                motorNotificacionesService.enviarNotificacionSaip(solicitud.getId(), new EnviarNotificacionRequest(
                        "Solicitud SAIP Vencida - Expediente " + solicitud.getExpediente(),
                        "Su solicitud SAIP " + solicitud.getExpediente() + " superó el límite registrado "
                                + solicitud.getFechaLimite() + ". Puede presentar un recurso de apelación.",
                        "Sistema - PlazoAlertaScheduler", false));
                log.info("Intento de notificación registrado para la solicitud {}.", solicitud.getId());
            } catch (Exception exception) {
                log.error("No se pudo registrar la notificación de vencimiento de la solicitud {}.", solicitud.getId());
            }
        }
        log.info("Auditoría SAIP: {} vencimientos persistidos.", vencidas.size());
    }

    /**
     * Tarea programada a la 1:00 AM para procesar subsanaciones vencidas
     * tanto en SAIP (1ª instancia) como en TTAIP Apelaciones (2ª instancia).
     */
    @Scheduled(cron = "0 0 1 * * *")
    @Transactional
    public void procesarSubsanacionesVencidasDiarias() {
        log.info("Iniciando procesamiento diario de subsanaciones vencidas...");

        // 1. Procesar observaciones SAIP vencidas
        try {
            List<pe.gob.saip.backend.model.entity.ObservacionSolicitud> obsVencidas = solicitudService.procesarObservacionesVencidas();
            log.info("Se procesaron {} observaciones SAIP vencidas.", obsVencidas.size());
        } catch (Exception e) {
            log.error("Error al procesar observaciones SAIP vencidas: {}", e.getMessage(), e);
        }

        // 2. Detectar vencimientos TTAIP; el cierre requiere una resolución registrada.
        try {
            int countTtaip = subsanacionTtaipService.procesarVencidas();
            log.info("Se detectaron {} subsanaciones TTAIP vencidas pendientes de resolución de cierre.", countTtaip);
        } catch (Exception e) {
            log.error("Error al procesar subsanaciones TTAIP vencidas: {}", e.getMessage(), e);
        }
    }
}
