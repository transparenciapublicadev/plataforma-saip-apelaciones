package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.model.dto.ActividadRecienteDTO;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Solicitud;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ActividadRecienteService {

    private final SolicitudService solicitudService;
    private final ApelacionService apelacionService;

    public ActividadRecienteService(SolicitudService solicitudService, ApelacionService apelacionService) {
        this.solicitudService = solicitudService;
        this.apelacionService = apelacionService;
    }

    /**
     * Arma el listado dentro de la transacción. Las resoluciones de la apelación
     * son una colección perezosa y el perfil de staging no mantiene la sesión
     * abierta después del controlador.
     */
    @Transactional(readOnly = true)
    public List<ActividadRecienteDTO> listar(int limite) {
        List<ActividadRecienteDTO> eventos = new ArrayList<>();

        for (Solicitud solicitud : solicitudService.obtenerTodasLasSolicitudes()) {
            String entidad = solicitud.getEntidad() != null ? solicitud.getEntidad().getNombre() : "Entidad";
            String expediente = solicitud.getExpediente() != null ? solicitud.getExpediente() : "SAIP";

            if (solicitud.getFechaPresentacion() != null) {
                long marcaTiempo = solicitud.getFechaPresentacion().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                eventos.add(new ActividadRecienteDTO(
                        "var(--info)",
                        "Solicitud SAIP registrada",
                        String.format("%s · %s · %s", expediente, entidad, solicitud.getFechaPresentacion().toLocalDate()),
                        solicitud.getFechaPresentacion(),
                        marcaTiempo
                ));
            }

            if (solicitud.getRespuesta() != null && solicitud.getRespuesta().getFechaRespuesta() != null) {
                long marcaTiempo = solicitud.getRespuesta().getFechaRespuesta().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                eventos.add(new ActividadRecienteDTO(
                        "var(--success)",
                        "Solicitud respondida",
                        String.format("%s · %s · %s", expediente, entidad, solicitud.getRespuesta().getFechaRespuesta().toLocalDate()),
                        solicitud.getRespuesta().getFechaRespuesta(),
                        marcaTiempo
                ));
            }

            if (Solicitud.EstadoSolicitud.VENCIDA.equals(solicitud.getEstado()) && solicitud.getFechaLimite() != null) {
                var momento = solicitud.getFechaLimite().atStartOfDay();
                long marcaTiempo = momento.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                eventos.add(new ActividadRecienteDTO(
                        "var(--brand-700)",
                        "Solicitud vencida detectada",
                        String.format("%s · %s · %s", expediente, entidad, solicitud.getFechaLimite()),
                        momento,
                        marcaTiempo
                ));
            }
        }

        for (Apelacion apelacion : apelacionService.findAll()) {
            String entidad = apelacion.getEntidadNombreEfectivo() != null ? apelacion.getEntidadNombreEfectivo() : "Tribunal";
            String expediente = apelacion.getExpediente() != null ? apelacion.getExpediente() : "TTAIP";

            if (apelacion.getFechaApelacion() != null) {
                boolean resuelta = apelacion.isResuelta();
                long marcaTiempo = apelacion.getFechaApelacion().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                eventos.add(new ActividadRecienteDTO(
                        resuelta ? "var(--gold-dark)" : "var(--brand-500)",
                        resuelta ? "Apelación presentada" : "Apelación en trámite",
                        String.format("%s · %s · %s", expediente, entidad, apelacion.getFechaApelacion().toLocalDate()),
                        apelacion.getFechaApelacion(),
                        marcaTiempo
                ));
            }

            if (apelacion.getResolucion() != null && apelacion.getResolucion().getFechaResolucion() != null) {
                long marcaTiempo = apelacion.getResolucion().getFechaResolucion().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                eventos.add(new ActividadRecienteDTO(
                        "var(--gold-dark)",
                        "Resolución TTAIP emitida",
                        String.format("%s · %s · %s", expediente, entidad, apelacion.getResolucion().getFechaResolucion().toLocalDate()),
                        apelacion.getResolucion().getFechaResolucion(),
                        marcaTiempo
                ));
            }
        }

        return eventos.stream()
                .sorted(Comparator.comparing(ActividadRecienteDTO::fecha, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(limite, 0))
                .toList();
    }
}
