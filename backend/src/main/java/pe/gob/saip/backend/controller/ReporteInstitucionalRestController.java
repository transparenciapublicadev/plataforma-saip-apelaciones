package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.ReporteInstitucionalDTO.*;
import pe.gob.saip.backend.service.ReporteInstitucionalService;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/reportes-institucionales/{modo}")
@Tag(name="Reportes institucionales",description="Consulta acotada y borradores; sin emisión formal ni remisión")
@SecurityRequirement(name="bearerAuth")
public class ReporteInstitucionalRestController {
    private final ReporteInstitucionalService service;
    public ReporteInstitucionalRestController(ReporteInstitucionalService service) { this.service=service; }
    private <T> ResponseEntity<T> ok(T body) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body); }
    @GetMapping("/resumen") @Operation(summary="Resumen por periodo y ámbito del actor")
    public ResponseEntity<Resumen> resumen(@PathVariable String modo,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate desde,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate hasta) { return ok(service.resumen(modo,desde,hasta)); }
    @GetMapping("/detalle") @Operation(summary="Detalle paginado del periodo; orden fecha e ID descendentes")
    public ResponseEntity<Pagina> detalle(@PathVariable String modo,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate desde,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate hasta,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="15") int size,@RequestParam(required=false) String query,@RequestParam(required=false) String estado) { return ok(service.detalle(modo,desde,hasta,page,size,query,estado)); }
    @GetMapping("/borrador") @Operation(summary="Recuperar el borrador persistido del periodo")
    public ResponseEntity<Borrador> borrador(@PathVariable String modo,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate desde,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate hasta) { return ok(service.borrador(modo,desde,hasta)); }
    @PutMapping("/borrador") @Operation(summary="Guardar borrador con versión esperada e identificación de operación",description="Repetición compatible devuelve el mismo borrador; versión o contenido incompatibles devuelven 409. No emite ni remite documentos.")
    public ResponseEntity<Borrador> guardar(@PathVariable String modo,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate desde,@RequestParam @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate hasta,@Valid @RequestBody Guardar input) { return ok(service.guardar(modo,desde,hasta,input)); }
    @GetMapping("/historial") @Operation(summary="Historial paginado de borradores del ámbito actual")
    public ResponseEntity<Historial> historial(@PathVariable String modo,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="15") int size) { return ok(service.historial(modo,page,size)); }
}
