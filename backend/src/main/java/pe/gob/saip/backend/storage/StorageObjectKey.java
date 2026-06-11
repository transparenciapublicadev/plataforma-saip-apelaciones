package pe.gob.saip.backend.storage;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

final class StorageObjectKey {

    private StorageObjectKey() {
    }

    static String create(String extension) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return "%d/%02d/%s.%s".formatted(
                today.getYear(),
                today.getMonthValue(),
                UUID.randomUUID(),
                extension);
    }

    static String requireSafe(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw invalid("La clave de almacenamiento es obligatoria");
        }
        if (storageKey.startsWith("/")
                || storageKey.startsWith("\\")
                || storageKey.contains("\\")
                || storageKey.indexOf('\0') >= 0) {
            throw invalid("La clave de almacenamiento no es válida");
        }
        for (String segment : storageKey.split("/", -1)) {
            if (segment.isBlank() || segment.equals(".") || segment.equals("..")) {
                throw invalid("La clave de almacenamiento contiene una ruta no permitida");
            }
        }
        return storageKey;
    }

    private static StorageException invalid(String message) {
        return new StorageException(StorageException.Reason.INVALID_INPUT, message);
    }
}
