package pe.gob.saip.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import pe.gob.saip.backend.storage.StorageException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> manejarValidacion(MethodArgumentNotValidException ex,
                                                            HttpServletRequest request) {
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "field", error.getField(),
                        "message", String.valueOf(error.getDefaultMessage())))
                .toList();

        String detail = errors.stream()
                .map(error -> error.get("field") + ": " + error.get("message"))
                .collect(Collectors.joining(", "));

        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.BAD_REQUEST,
                "Validation failed",
                detail.isBlank() ? "La solicitud contiene campos inválidos." : detail,
                request.getRequestURI());
        problem.setProperty("errors", errors);
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<ProblemDetail> manejarNoEncontrado(RecursoNoEncontradoException ex,
                                                              HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.NOT_FOUND,
                "Resource not found",
                ex.getMessage(),
                request.getRequestURI());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetail> manejarArgumentoInvalido(IllegalArgumentException ex,
                                                                   HttpServletRequest request) {
        HttpStatus status = classifyBusinessStatus(ex.getMessage());
        ProblemDetail problem = ApiProblemDetails.create(
                status,
                titleFor(status),
                ex.getMessage(),
                request.getRequestURI());
        return ResponseEntity.status(status).body(problem);
    }

    @ExceptionHandler({
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            ConstraintViolationException.class
    })
    public ResponseEntity<ProblemDetail> manejarBadRequest(Exception ex, HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.BAD_REQUEST,
                "Bad request",
                ex.getMessage(),
                request.getRequestURI());
        return ResponseEntity.badRequest().body(problem);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ProblemDetail> manejarConflictoPersistencia(DataIntegrityViolationException ex,
                                                                       HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.CONFLICT,
                "Conflict",
                "La operación viola una restricción de datos o duplicidad.",
                request.getRequestURI());
        problem.setProperty("diagnosticHint", "Verifique IDs, unicidad y alineación del seed SQL.");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ProblemDetail> manejarNoAutenticado(AuthenticationException ex,
                                                               HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.UNAUTHORIZED,
                "Unauthorized",
                "Token faltante, inválido o expirado.",
                request.getRequestURI());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(problem);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> manejarAccesoDenegado(AccessDeniedException ex,
                                                                HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.FORBIDDEN,
                "Forbidden",
                "El usuario autenticado no tiene permisos para ejecutar esta operación.",
                request.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> manejarRecursoNoEncontrado(NoResourceFoundException ex,
                                                                     HttpServletRequest request) {
        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.NOT_FOUND,
                "Endpoint not found",
                "No existe un endpoint para la ruta solicitada.",
                request.getRequestURI());
        problem.setProperty("ruta", ex.getResourcePath());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
    }


    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ProblemDetail> manejarEstadoIlegal(IllegalStateException ex,
                                                              HttpServletRequest request) {
        LOGGER.error("Error de estado interno: {}", ex.getMessage(), ex);

        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal server error",
                ex.getMessage(),
                request.getRequestURI());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }

    @ExceptionHandler(StorageException.class)
    public ResponseEntity<ProblemDetail> manejarStorage(StorageException ex,
                                                         HttpServletRequest request) {
        HttpStatus status = switch (ex.getReason()) {
            case INVALID_INPUT -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case IO_ERROR -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
        if (ex.getReason() == StorageException.Reason.IO_ERROR) {
            LOGGER.error("Error controlado de almacenamiento documental", ex);
        }

        String detail = ex.getReason() == StorageException.Reason.IO_ERROR
                ? "No fue posible completar la operación documental."
                : ex.getMessage();
        ProblemDetail problem = ApiProblemDetails.create(
                status,
                status == HttpStatus.NOT_FOUND ? "Resource not found"
                        : status == HttpStatus.BAD_REQUEST ? "Bad request" : "Internal server error",
                detail,
                request.getRequestURI());
        return ResponseEntity.status(status).body(problem);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> manejarGeneral(Exception ex, HttpServletRequest request) {
        LOGGER.error("Error interno no controlado", ex);

        ProblemDetail problem = ApiProblemDetails.create(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal server error",
                "Ocurrió un error inesperado. Intente nuevamente.",
                request.getRequestURI());
        problem.setProperty("diagnosticHint", "Revisar logs del backend; este error no debe ocultarse en Newman.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(problem);
    }

    private static HttpStatus classifyBusinessStatus(String message) {
        String normalized = message == null ? "" : message.toLowerCase();
        if (normalized.contains("ya existe")
                || normalized.contains("ya tiene")
                || normalized.contains("duplic")
                || normalized.contains("no se puede eliminar")) {
            return HttpStatus.CONFLICT;
        }
        if (normalized.contains("estado")
                || normalized.contains("plazo")
                || normalized.contains("transici")
                || normalized.contains("silencio administrativo")
                || normalized.contains("regla de negocio")) {
            return HttpStatus.UNPROCESSABLE_ENTITY;
        }
        return HttpStatus.BAD_REQUEST;
    }

    private static String titleFor(HttpStatus status) {
        return switch (status) {
            case CONFLICT -> "Conflict";
            case UNPROCESSABLE_ENTITY -> "Business rule violation";
            default -> "Bad request";
        };
    }
}
