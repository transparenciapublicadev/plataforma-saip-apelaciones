package pe.gob.saip.backend.storage;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import pe.gob.saip.backend.config.StorageProperties;

@Component
@ConditionalOnProperty(prefix = "app.storage", name = "provider", havingValue = "local", matchIfMissing = true)
public class LocalStorageProvider implements StorageProvider {

    private static final int BUFFER_SIZE = 8192;
    private static final String LOCAL_BUCKET = "local";
    private static final Map<String, Set<String>> ALLOWED_EXTENSIONS = Map.of(
            "application/pdf", Set.of("pdf"),
            "image/png", Set.of("png"),
            "image/jpeg", Set.of("jpg", "jpeg"),
            "text/plain", Set.of("txt"));

    private final Path basePath;
    private final long maxFileSize;
    private final Set<String> allowedContentTypes;

    public LocalStorageProvider(StorageProperties properties) {
        String configuredPath = properties.getLocal().getBasePath();
        if (configuredPath == null || configuredPath.isBlank()) {
            throw new IllegalStateException(
                    "APP_STORAGE_LOCAL_BASE_PATH es obligatorio cuando app.storage.provider=local");
        }

        this.basePath = Path.of(configuredPath).toAbsolutePath().normalize();
        this.maxFileSize = properties.getMaxFileSize();
        this.allowedContentTypes = properties.getAllowedContentTypes().stream()
                .map(LocalStorageProvider::normalizeContentType)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());

        if (maxFileSize <= 0) {
            throw new IllegalStateException("app.storage.max-file-size debe ser mayor que cero");
        }

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
        validateRequest(request);

        String safeFilename = sanitizeOriginalFilename(request.originalFilename());
        String contentType = normalizeContentType(request.contentType());
        String extension = validateExtension(safeFilename, contentType);
        Path temporaryFile = resolveInsideBase(".tmp/" + UUID.randomUUID() + ".upload");

        try {
            Files.createDirectories(temporaryFile.getParent());
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long size = copyAndHash(request.content(), temporaryFile, digest);

            if (request.declaredSize() >= 0 && request.declaredSize() != size) {
                throw invalid("El tamaño declarado del archivo no coincide con su contenido");
            }
            validateContentSignature(temporaryFile, contentType);

            String storageKey = createStorageKey(extension);
            Path destination = resolveInsideBase(storageKey);
            Files.createDirectories(destination.getParent());
            rejectSymbolicLinks(destination);
            moveAtomicallyWhenPossible(temporaryFile, destination);

            StorageObjectMetadata metadata = new StorageObjectMetadata(
                    type(),
                    LOCAL_BUCKET,
                    storageKey,
                    safeFilename,
                    contentType,
                    size,
                    HexFormat.of().formatHex(digest.digest()));
            return new StorageUploadResult(metadata);
        } catch (StorageException exception) {
            deleteQuietly(temporaryFile);
            throw exception;
        } catch (IOException | NoSuchAlgorithmException exception) {
            deleteQuietly(temporaryFile);
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
                    normalizeContentType(contentType),
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

    static String sanitizeOriginalFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            throw invalid("El nombre original del archivo es obligatorio");
        }
        if (originalFilename.indexOf('\0') >= 0
                || originalFilename.contains("/")
                || originalFilename.contains("\\")) {
            throw invalid("El nombre original del archivo contiene una ruta no permitida");
        }

        String sanitized = originalFilename.strip()
                .replaceAll("[\\p{Cntrl}]", "")
                .replaceAll("\\s+", " ");
        if (sanitized.isBlank()) {
            throw invalid("El nombre original del archivo no es válido");
        }
        return sanitized.length() <= 255 ? sanitized : sanitized.substring(sanitized.length() - 255);
    }

    private void validateRequest(StorageUploadRequest request) {
        if (request == null || request.content() == null) {
            throw invalid("El contenido del archivo es obligatorio");
        }
        if (request.declaredSize() == 0) {
            throw invalid("El archivo no puede estar vacío");
        }
        if (request.declaredSize() > maxFileSize) {
            throw invalid("El archivo supera el tamaño máximo permitido");
        }
        String contentType = normalizeContentType(request.contentType());
        if (!allowedContentTypes.contains(contentType) || !ALLOWED_EXTENSIONS.containsKey(contentType)) {
            throw invalid("El tipo de contenido no está permitido: " + contentType);
        }
    }

    private String validateExtension(String filename, String contentType) {
        int separator = filename.lastIndexOf('.');
        if (separator < 1 || separator == filename.length() - 1) {
            throw invalid("El archivo debe tener una extensión permitida");
        }
        String extension = filename.substring(separator + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.getOrDefault(contentType, Set.of()).contains(extension)) {
            throw invalid("La extensión del archivo no corresponde al tipo de contenido declarado");
        }
        return extension.equals("jpeg") ? "jpg" : extension;
    }

    private long copyAndHash(InputStream content, Path target, MessageDigest digest) throws IOException {
        long total = 0;
        byte[] buffer = new byte[BUFFER_SIZE];
        try (InputStream input = new BufferedInputStream(content);
                OutputStream output = new BufferedOutputStream(Files.newOutputStream(target))) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > maxFileSize) {
                    throw invalid("El archivo supera el tamaño máximo permitido");
                }
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
        }
        if (total == 0) {
            throw invalid("El archivo no puede estar vacío");
        }
        return total;
    }

    private void validateContentSignature(Path file, String contentType) throws IOException {
        byte[] bytes = Files.readAllBytes(file);
        boolean valid = switch (contentType) {
            case "application/pdf" -> startsWith(bytes, "%PDF-".getBytes(StandardCharsets.US_ASCII));
            case "image/png" -> startsWith(bytes, new byte[]{
                    (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
            case "image/jpeg" -> bytes.length >= 3
                    && bytes[0] == (byte) 0xFF
                    && bytes[1] == (byte) 0xD8
                    && bytes[2] == (byte) 0xFF;
            case "text/plain" -> isValidUtf8Text(bytes);
            default -> false;
        };
        if (!valid) {
            throw invalid("El contenido del archivo no corresponde al tipo declarado");
        }
    }

    private boolean isValidUtf8Text(byte[] bytes) {
        for (byte value : bytes) {
            if (value == 0) {
                return false;
            }
        }
        try {
            StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes));
            return true;
        } catch (CharacterCodingException exception) {
            return false;
        }
    }

    private boolean startsWith(byte[] content, byte[] prefix) {
        if (content.length < prefix.length) {
            return false;
        }
        for (int index = 0; index < prefix.length; index++) {
            if (content[index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private String createStorageKey(String extension) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return "%d/%02d/%s.%s".formatted(
                today.getYear(),
                today.getMonthValue(),
                UUID.randomUUID(),
                extension);
    }

    private Path resolveInsideBase(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw invalid("La clave de almacenamiento es obligatoria");
        }
        Path key = Path.of(storageKey);
        if (key.isAbsolute()) {
            throw invalid("La clave de almacenamiento no puede ser absoluta");
        }
        Path resolved = basePath.resolve(key).normalize();
        if (!resolved.startsWith(basePath)) {
            throw invalid("La clave de almacenamiento intenta salir del directorio permitido");
        }
        return resolved;
    }

    private void rejectSymbolicLinks(Path target) {
        Path current = basePath;
        for (Path segment : basePath.relativize(target)) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)
                    && Files.isSymbolicLink(current)) {
                throw invalid("La clave de almacenamiento contiene un enlace simbólico no permitido");
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

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // The original storage error remains the actionable failure.
        }
    }

    private static String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "application/octet-stream";
        }
        int parameters = contentType.indexOf(';');
        String normalized = parameters >= 0 ? contentType.substring(0, parameters) : contentType;
        return normalized.trim().toLowerCase(Locale.ROOT);
    }

    private static StorageException invalid(String message) {
        return new StorageException(StorageException.Reason.INVALID_INPUT, message);
    }
}
