package pe.gob.saip.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path rootLocation;

    public FileStorageService(@Value("${app.upload-dir:uploads}") String uploadDir) {
        this.rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.rootLocation);
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo inicializar el directorio de carga", ex);
        }
    }

    public String storeFile(MultipartFile file, String subDirectory) {
        if (file == null || file.isEmpty()) {
            return null;
        }

        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename());
        String uniqueFileName = UUID.randomUUID().toString() + "-" + originalFileName;

        try {
            Path targetDirectory = subDirectory == null || subDirectory.isBlank()
                    ? rootLocation
                    : rootLocation.resolve(subDirectory).normalize();

            Files.createDirectories(targetDirectory);
            Path destinationFile = targetDirectory.resolve(uniqueFileName);
            Files.copy(file.getInputStream(), destinationFile, StandardCopyOption.REPLACE_EXISTING);

            return rootLocation.relativize(destinationFile).toString().replace("\\", "/");
        } catch (IOException ex) {
            throw new IllegalStateException("Error al guardar el archivo " + originalFileName, ex);
        }
    }

    public Resource loadAsResource(String relativePath) {
        try {
            Path filePath = rootLocation.resolve(relativePath).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new IllegalStateException("No se pudo leer el archivo: " + relativePath);
        } catch (MalformedURLException ex) {
            throw new IllegalStateException("Ruta inválida: " + relativePath, ex);
        }
    }

    public Path resolvePath(String relativePath) {
        return rootLocation.resolve(relativePath).normalize();
    }
}
