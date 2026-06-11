package pe.gob.saip.backend.storage;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import pe.gob.saip.backend.config.StorageProperties;

@Component
@ConditionalOnProperty(prefix = "app.storage", name = "provider", havingValue = "local", matchIfMissing = true)
public class LocalStorageProvider implements StorageProvider {

    private static final String LOCAL_BUCKET = "local";

    private final Path basePath;
    private final StorageUploadValidator uploadValidator;

    public LocalStorageProvider(
            StorageProperties properties,
            StorageUploadValidator uploadValidator) {
        String configuredPath = properties.getLocal().getBasePath();
        if (configuredPath == null || configuredPath.isBlank()) {
            throw new IllegalStateException(
                    "APP_STORAGE_LOCAL_BASE_PATH es obligatorio cuando APP_STORAGE_PROVIDER=local");
        }

        this.basePath = Path.of(configuredPath).toAbsolutePath().normalize();
        this.uploadValidator = uploadValidator;

        try {
            Files.createDirectories(basePath);
        } catch (IOException exception) {
            throw new IllegalStateException("No se pudo inicializar el almacenamiento documental local", exception);
        }
    }

    @Override
    public StorageProviderType type() {
        return StorageProviderType.LOCAL;
    }

    @Override
    public StorageUploadResult upload(StorageUploadRequest request) {
        try (ValidatedStorageUpload validated = uploadValidator.validate(request)) {
            String storageKey = StorageObjectKey.create(validated.extension());
            Path destination = resolveInsideBase(storageKey);
            rejectSymbolicLinks(destination);
            Files.createDirectories(destination.getParent());
            rejectSymbolicLinks(destination);
            moveAtomicallyWhenPossible(validated.temporaryFile(), destination);

            return new StorageUploadResult(new StorageObjectMetadata(
                    type(),
                    LOCAL_BUCKET,
                    storageKey,
                    validated.originalFilename(),
                    validated.contentType(),
                    validated.sizeBytes(),
                    validated.hashSha256()));
        } catch (StorageException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "No fue posible almacenar el documento",
                    exception);
        }
    }

    @Override
    public StorageDownloadResult download(String storageKey, String contentType) {
        Path storedFile = resolveInsideBase(storageKey);
        rejectSymbolicLinks(storedFile);
        try {
            if (!Files.isRegularFile(storedFile) || !Files.isReadable(storedFile)) {
                throw new StorageException(
                        StorageException.Reason.NOT_FOUND,
                        "El archivo documental solicitado no está disponible");
            }
            return new StorageDownloadResult(
                    new BufferedInputStream(Files.newInputStream(storedFile)),
                    StorageUploadValidator.normalizeContentType(contentType),
                    Files.size(storedFile));
        } catch (StorageException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "No fue posible abrir el documento almacenado",
                    exception);
        }
    }

    @Override
    public boolean exists(String storageKey) {
        Path storedFile = resolveInsideBase(storageKey);
        rejectSymbolicLinks(storedFile);
        return Files.isRegularFile(storedFile);
    }

    @Override
    public void delete(String storageKey) {
        Path storedFile = resolveInsideBase(storageKey);
        rejectSymbolicLinks(storedFile);
        try {
            Files.deleteIfExists(storedFile);
        } catch (IOException exception) {
            throw new StorageException(
                    StorageException.Reason.IO_ERROR,
                    "No fue posible eliminar el documento almacenado",
                    exception);
        }
    }

    private Path resolveInsideBase(String storageKey) {
        String safeStorageKey = StorageObjectKey.requireSafe(storageKey);
        Path resolved = basePath.resolve(safeStorageKey).normalize();
        if (!resolved.startsWith(basePath)) {
            throw new StorageException(
                    StorageException.Reason.INVALID_INPUT,
                    "La clave de almacenamiento intenta salir del directorio permitido");
        }
        return resolved;
    }

    private void rejectSymbolicLinks(Path target) {
        Path current = basePath;
        for (Path segment : basePath.relativize(target)) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)
                    && Files.isSymbolicLink(current)) {
                throw new StorageException(
                        StorageException.Reason.INVALID_INPUT,
                        "La clave de almacenamiento contiene un enlace simbólico no permitido");
            }
        }
    }

    private void moveAtomicallyWhenPossible(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(source, target);
        }
    }
}
