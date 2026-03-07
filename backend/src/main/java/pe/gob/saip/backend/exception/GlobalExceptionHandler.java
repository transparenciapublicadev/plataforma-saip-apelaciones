package pe.gob.saip.backend.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> manejarValidacion(MethodArgumentNotValidException ex) {
        String mensaje = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        Map<String, Object> error = new HashMap<>();
        error.put("success", false);
        error.put("mensaje", mensaje);
        error.put("timestamp", LocalDateTime.now());
        error.put("status", 400);
        return ResponseEntity.badRequest().body(error);
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<Map<String, Object>> manejarNoEncontrado(RecursoNoEncontradoException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("mensaje", ex.getMessage());
        error.put("timestamp", LocalDateTime.now());
        error.put("status", 404);
        return ResponseEntity.status(404).body(error);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> manejarArgumentoInvalido(IllegalArgumentException ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("mensaje", ex.getMessage());
        error.put("timestamp", LocalDateTime.now());
        error.put("status", 400);
        return ResponseEntity.status(400).body(error);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> manejarGeneral(Exception ex) {
        Map<String, Object> error = new HashMap<>();
        error.put("mensaje", "Error interno del servidor");
        error.put("detalle", ex.getMessage());
        error.put("timestamp", LocalDateTime.now());
        error.put("status", 500);
        return ResponseEntity.status(500).body(error);
    }
}

