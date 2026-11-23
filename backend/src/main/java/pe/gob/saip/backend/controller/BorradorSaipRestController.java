package pe.gob.saip.backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.model.dto.BorradorSaipDTO;
import pe.gob.saip.backend.model.dto.GuardarBorradorSaipRequest;
import pe.gob.saip.backend.service.BorradorSaipService;

import java.util.List;

/** Borradores de SAIP del administrado de la sesión. No abre un expediente. */
@RestController
@RequestMapping("/api/borradores-saip")
@RequiredArgsConstructor
public class BorradorSaipRestController {

    private final BorradorSaipService borradores;

    @GetMapping
    public ResponseEntity<List<BorradorSaipDTO>> listar() {
        return sinCache(borradores.listar());
    }

    @GetMapping("/{id}")
    public ResponseEntity<BorradorSaipDTO> obtener(@PathVariable Long id) {
        return sinCache(borradores.obtener(id));
    }

    @PostMapping
    public ResponseEntity<BorradorSaipDTO> crear(@Valid @RequestBody GuardarBorradorSaipRequest datos) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(borradores.guardar(null, datos));
    }

    @PutMapping("/{id}")
    public ResponseEntity<BorradorSaipDTO> actualizar(@PathVariable Long id,
                                                      @Valid @RequestBody GuardarBorradorSaipRequest datos) {
        return sinCache(borradores.guardar(id, datos));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        borradores.eliminar(id);
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    private static <T> ResponseEntity<T> sinCache(T cuerpo) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(cuerpo);
    }
}
