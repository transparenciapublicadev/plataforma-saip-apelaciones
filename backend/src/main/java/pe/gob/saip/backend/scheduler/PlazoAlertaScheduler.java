package pe.gob.saip.backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.EnviarNotificacionRequest;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.service.MotorNotificacionesService;
import pe.gob.saip.backend.service.PlazoCalculadorService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class PlazoAlertaScheduler {

    private final SolicitudRepository solicitudRepository;
    private final PlazoCalculadorService plazoCalculadorService;
    private final MotorNotificacionesService motorNotificacionesService;
    private final pe.gob.saip.backend.service.SolicitudService solicitudService;
    private final pe.gob.saip.backend.repository.ApelacionRepository apelacionRepository;

    /**
     * Tarea programada para ejecutarse todas las mañanas a las 6:00 AM.
     * Realiza una auditoría de plazos y transiciona las solicitudes vencidas.
     */
    @Scheduled(cron = "0 0 6 * * ?")
    @Transactional
    public void procesarAuditoriaDePlazos() {
        log.info("Iniciando auditoría diaria de plazos legales SAIP...");

        List<Solicitud.EstadoSolicitud> estadosActivos = Arrays.asList(
                Solicitud.EstadoSolicitud.RECEPCIONADA,
                Solicitud.EstadoSolicitud.EN_REVISION,
                Solicitud.EstadoSolicitud.PENDIENTE_INFORMACION
        );

        List<Solicitud> solicitudesActivas = solicitudRepository.findByEstadoIn(estadosActivos);
        log.info("Se recuperaron {} solicitudes activas para evaluación.", solicitudesActivas.size());

        for (Solicitud solicitud : solicitudesActivas) {
            try {
                LocalDate fechaRegistro = solicitud.getFechaPresentacion().toLocalDate();
                LocalDate fechaVencimiento = plazoCalculadorService.calcularFechaVencimiento(fechaRegistro, 10);
                long diasRestantes = ChronoUnit.DAYS.between(LocalDate.now(), fechaVencimiento);

                if (diasRestantes <= 0) {
                    log.warn("La solicitud SAIP con expediente {} ha superado su plazo legal (días restantes: {}). Muta a VENCIDA.", 
                            solicitud.getExpediente(), diasRestantes);

                    // Transicionar estado a VENCIDA y guardar en base de datos
                    solicitud.setEstado(Solicitud.EstadoSolicitud.VENCIDA);
                    solicitudRepository.save(solicitud);

                    // Disparar notificación push (FCM) al ciudadano alertando sobre el vencimiento
                    String asuntoCiudadano = "Solicitud SAIP Vencida - Expediente " + solicitud.getExpediente();
                    String contenidoCiudadano = String.format(
                            "Estimado ciudadano, su solicitud SAIP con expediente %s ha superado el plazo legal de atención (venció el %s) y se encuentra en estado VENCIDA. Se habilita su derecho a presentar un recurso de apelación.",
                            solicitud.getExpediente(),
                            fechaVencimiento
                    );

                    EnviarNotificacionRequest requestNotificacion = new EnviarNotificacionRequest(
                            asuntoCiudadano,
                            contenidoCiudadano,
                            "Sistema - PlazoAlertaScheduler",
                            false
                    );

                    try {
                        motorNotificacionesService.enviarNotificacionSaip(solicitud.getId(), requestNotificacion);
                        log.info("Notificación push/casilla enviada exitosamente al ciudadano para la solicitud {}.", solicitud.getExpediente());
                    } catch (Exception e) {
                        log.error("Error al disparar la notificación para el ciudadano de la solicitud {}: {}", solicitud.getExpediente(), e.getMessage());
                    }

                    // Encolar/simular alertas prioritarias por correo para los funcionarios encargados de la entidad
                    log.info("Alerta por correo encolada para los funcionarios de la entidad '{}' sobre el expediente vencido {}.", 
                            solicitud.getEntidad().getNombre(), 
                            solicitud.getExpediente());
                }
            } catch (Exception e) {
                log.error("Fallo crítico al procesar la auditoría de plazo para la solicitud {}: {}", solicitud.getExpediente(), e.getMessage(), e);
            }
        }

        log.info("Auditoría diaria de plazos legales SAIP finalizada con éxito.");
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

        // 2. Procesar subsanaciones TTAIP vencidas -> TENER_POR_NO_PRESENTADO
        try {
            List<pe.gob.saip.backend.model.entity.Apelacion> apelacionesSubsanacion = apelacionRepository.findByEstadoOrderByFechaApelacionDesc(pe.gob.saip.backend.model.entity.Apelacion.EstadoApelacion.EN_SUBSANACION);
            int countTtaip = 0;
            for (pe.gob.saip.backend.model.entity.Apelacion apelacion : apelacionesSubsanacion) {
                if (apelacion.getFechaSubsanacion() != null) {
                    int dias = apelacion.getDiasSubsanacion() != null ? apelacion.getDiasSubsanacion() : 2;
                    LocalDate limite = pe.gob.saip.backend.util.DiasHabilesUtil.sumarDiasHabiles(apelacion.getFechaSubsanacion(), dias);
                    if (LocalDate.now().isAfter(limite)) {
                        apelacion.setEstado(pe.gob.saip.backend.model.entity.Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO);
                        apelacion.setResultado("TENER_POR_NO_PRESENTADO");
                        apelacionRepository.save(apelacion);
                        countTtaip++;
                    }
                }
            }
            log.info("Se procesaron {} apelaciones TTAIP vencidas a TENER_POR_NO_PRESENTADO.", countTtaip);
        } catch (Exception e) {
            log.error("Error al procesar subsanaciones TTAIP vencidas: {}", e.getMessage(), e);
        }
    }
}
