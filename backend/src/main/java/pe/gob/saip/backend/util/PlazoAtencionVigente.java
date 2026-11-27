package pe.gob.saip.backend.util;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Días hábiles de atención SAIP vigentes para el alta de una solicitud.
 * El valor publicado sale de la configuración guardada; si aún no hay
 * configuración, se mantiene el plazo de 10 días hábiles.
 */
public final class PlazoAtencionVigente {

    private static final int POR_DEFECTO = 10;
    private static final AtomicInteger DIAS = new AtomicInteger(POR_DEFECTO);

    private PlazoAtencionVigente() {}

    public static int dias() {
        int valor = DIAS.get();
        return valor > 0 ? valor : POR_DEFECTO;
    }

    public static void publicar(int dias) {
        if (dias > 0) {
            DIAS.set(dias);
        }
    }
}
