package pe.gob.saip.backend.exception;

/** Rejects an expired submission without substituting for the required closing resolution. */
public class PlazoSubsanacionTtaipVencidoException extends IllegalArgumentException {
    public PlazoSubsanacionTtaipVencidoException() {
        super("El plazo de 2 días hábiles para subsanar la apelación ha vencido. El cierre requiere la resolución correspondiente.");
    }
}
