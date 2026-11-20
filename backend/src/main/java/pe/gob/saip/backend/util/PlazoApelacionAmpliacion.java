package pe.gob.saip.backend.util;

import java.time.LocalDate;
import java.util.List;

import pe.gob.saip.backend.model.entity.AmpliacionPlazoSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud;
import pe.gob.saip.backend.model.entity.CronogramaEntregaParcialSolicitud.EstadoEntregaParcial;
import pe.gob.saip.backend.model.entity.Solicitud;

/**
 * La ampliación se apela desde el día hábil siguiente al vencimiento ordinario,
 * durante 15 días hábiles. Cada entrega recibida abre otro plazo de 15 días hábiles.
 */
public final class PlazoApelacionAmpliacion {

    public static final int DIAS_HABILES = 15;

    private PlazoApelacionAmpliacion() {}

    public static void validar(Solicitud solicitud, LocalDate hoy) {
        if (!permite(solicitud, hoy)) {
            throw new IllegalArgumentException(
                "El plazo para apelar el cronograma no está abierto. Puede apelar desde el día hábil siguiente al vencimiento ordinario, durante 15 días hábiles, o cuando reciba una entrega.");
        }
    }

    public static boolean permite(Solicitud solicitud, LocalDate hoy) {
        AmpliacionPlazoSolicitud activa = activa(solicitud);
        if (activa == null) {
            return true;
        }
        Solicitud.EstadoSolicitud estado = solicitud.getEstado();
        if (estado == Solicitud.EstadoSolicitud.DENEGADA
                || estado == Solicitud.EstadoSolicitud.VENCIDA
                || estado == Solicitud.EstadoSolicitud.RESPONDIDA
                || solicitud.getRespuesta() != null) {
            return true;
        }
        if (solicitud.getFechaLimite() != null && hoy.isAfter(solicitud.getFechaLimite())) {
            return true;
        }
        return cronogramaAbierto(activa, hoy) || entregaAbierta(activa, hoy) || incumplida(activa, hoy);
    }

    private static boolean cronogramaAbierto(AmpliacionPlazoSolicitud ampliacion, LocalDate hoy) {
        LocalDate ordinario = ampliacion.getFechaLimiteOriginal();
        if (ordinario == null || !hoy.isAfter(ordinario)) {
            return false;
        }
        return restantes(ordinario, hoy) >= 0;
    }

    private static boolean entregaAbierta(AmpliacionPlazoSolicitud ampliacion, LocalDate hoy) {
        for (CronogramaEntregaParcialSolicitud hito : cronograma(ampliacion)) {
            if (hito.getEstado() != EstadoEntregaParcial.ENTREGADA || !propia(hito, ampliacion)) {
                continue;
            }
            LocalDate ancla = hito.getFechaEntregaReal() != null ? hito.getFechaEntregaReal() : hito.getFechaProgramada();
            if (ancla == null || restantes(ancla, hoy) >= 0) {
                return true;
            }
        }
        return false;
    }

    private static boolean incumplida(AmpliacionPlazoSolicitud ampliacion, LocalDate hoy) {
        return cronograma(ampliacion).stream().anyMatch(hito -> propia(hito, ampliacion) && hito.incumplida(hoy));
    }

    private static int restantes(LocalDate ancla, LocalDate hoy) {
        LocalDate limite = DiasHabilesUtil.sumarDiasHabiles(ancla, DIAS_HABILES);
        if (hoy.isAfter(limite)) {
            return -1;
        }
        return DiasHabilesUtil.diasHabilesVigentes(ancla, limite, hoy);
    }

    private static AmpliacionPlazoSolicitud activa(Solicitud solicitud) {
        List<AmpliacionPlazoSolicitud> ampliaciones = solicitud.getAmpliacionesPlazo();
        if (ampliaciones == null) {
            return null;
        }
        return ampliaciones.stream()
            .filter(item -> item.getEstadoAmpliacion() != AmpliacionPlazoSolicitud.EstadoAmpliacion.CANCELADA)
            .findFirst()
            .orElse(null);
    }

    private static List<CronogramaEntregaParcialSolicitud> cronograma(AmpliacionPlazoSolicitud ampliacion) {
        return ampliacion.getCronograma() == null ? List.of() : ampliacion.getCronograma();
    }

    private static boolean propia(CronogramaEntregaParcialSolicitud hito, AmpliacionPlazoSolicitud ampliacion) {
        return hito.getAmpliacion() == null
            || hito.getAmpliacion() == ampliacion
            || hito.getAmpliacion().getIdAmpliacion() != null
                && hito.getAmpliacion().getIdAmpliacion().equals(ampliacion.getIdAmpliacion());
    }
}
