package pe.gob.saip.backend.exception;

public class ConflictoEstadoException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public ConflictoEstadoException(String mensaje) {
        super(mensaje);
    }
}
