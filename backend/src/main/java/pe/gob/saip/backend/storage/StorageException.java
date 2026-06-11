package pe.gob.saip.backend.storage;

public class StorageException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final Reason reason;

    public StorageException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public StorageException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }

    public enum Reason {
        INVALID_INPUT,
        NOT_FOUND,
        IO_ERROR
    }
}
