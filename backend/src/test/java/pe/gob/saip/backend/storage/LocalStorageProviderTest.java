package pe.gob.saip.backend.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import pe.gob.saip.backend.config.StorageProperties;

class LocalStorageProviderTest {

    private static final byte[] PDF_CONTENT = "%PDF-1.4\ncontenido de prueba\n%%EOF"
            .getBytes(StandardCharsets.UTF_8);

    @TempDir
    Path tempDir;

    private LocalStorageProvider provider;

    @BeforeEach
    void setUp() {
        StorageProperties properties = new StorageProperties();
        properties.getLocal().setBasePath(tempDir.resolve("storage").toString());
        properties.setMaxFileSize(1024);
        properties.setAllowedContentTypes(Set.of(
                "application/pdf",
                "image/png",
                "image/jpeg",
                "text/plain"));
        provider = new LocalStorageProvider(properties, new StorageUploadValidator(properties));
    }

    @Test
    void uploadGeneratesOpaqueKeyAndSha256OutsideOriginalName() throws Exception {
        StorageUploadResult result = upload(
                "resolucion-ciudadano.pdf",
                "application/pdf",
                PDF_CONTENT);

        StorageObjectMetadata metadata = result.metadata();
        assertThat(metadata.storageKey())
                .doesNotContain("resolucion-ciudadano")
                .matches("\\d{4}/\\d{2}/[0-9a-f-]{36}\\.pdf");
        assertThat(metadata.originalFilename()).isEqualTo("resolucion-ciudadano.pdf");
        assertThat(metadata.hashSha256()).isEqualTo(HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(PDF_CONTENT)));
        assertThat(provider.exists(metadata.storageKey())).isTrue();
        assertThat(Files.readAllBytes(tempDir.resolve("storage").resolve(metadata.storageKey())))
                .isEqualTo(PDF_CONTENT);
    }

    @Test
    void uploadRejectsPathTraversalInOriginalFilename() {
        assertThatThrownBy(() -> upload("../../secreto.pdf", "application/pdf", PDF_CONTENT))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("ruta no permitida");
    }

    @Test
    void uploadRejectsDisallowedContentTypeAndOversizedContent() {
        assertThatThrownBy(() -> upload("payload.exe", "application/octet-stream", new byte[]{1}))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("tipo de contenido");

        byte[] oversized = new byte[1025];
        assertThatThrownBy(() -> upload("grande.txt", "text/plain", oversized))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("tamaño máximo");
    }

    @Test
    void uploadRejectsContentThatDoesNotMatchDeclaredType() {
        assertThatThrownBy(() -> upload(
                "falso.pdf",
                "application/pdf",
                "no es pdf".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("no corresponde");
    }

    @Test
    void downloadAndDeleteUseOnlyGeneratedStorageKey() throws Exception {
        StorageObjectMetadata metadata = upload(
                "informe.txt",
                "text/plain",
                "contenido".getBytes(StandardCharsets.UTF_8))
                .metadata();

        StorageDownloadResult download = provider.download(
                metadata.storageKey(),
                metadata.contentType());
        try (var content = download.content()) {
            assertThat(content.readAllBytes())
                    .isEqualTo("contenido".getBytes(StandardCharsets.UTF_8));
        }

        provider.delete(metadata.storageKey());
        assertThat(provider.exists(metadata.storageKey())).isFalse();
        assertThatThrownBy(() -> provider.download("../fuera.txt", "text/plain"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("ruta no permitida");
    }

    @Test
    void downloadRejectsSymbolicLinkInsideStorageWhenSupported() throws Exception {
        Path outside = tempDir.resolve("outside.txt");
        Files.writeString(outside, "fuera");
        Path link = tempDir.resolve("storage").resolve("link.txt");
        try {
            Files.createSymbolicLink(link, outside);
        } catch (UnsupportedOperationException | java.nio.file.FileSystemException exception) {
            return;
        }

        assertThatThrownBy(() -> provider.download("link.txt", "text/plain"))
                .isInstanceOf(StorageException.class)
                .hasMessageContaining("enlace simbólico");
    }

    private StorageUploadResult upload(String filename, String contentType, byte[] content) {
        return provider.upload(new StorageUploadRequest(
                filename,
                contentType,
                content.length,
                new ByteArrayInputStream(content)));
    }
}
