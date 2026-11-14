package pe.gob.saip.backend.controller;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.PanelConsultaService;

@RestController
@RequestMapping("/api/panel")
@SecurityRequirement(name="bearerAuth")
public class PanelConsultaRestController {
    private final PanelConsultaService service;
    public PanelConsultaRestController(PanelConsultaService service){this.service=service;}
    @GetMapping("/solicitudes")
    @Operation(summary="Consultar página y agregados SAIP del actor actual",description="Autorización previa a filtros y paginación. Agregados sobre todo el alcance autorizado antes de filtros de página/búsqueda. No acredita entrega ni eficacia.")
    public ResponseEntity<PanelPaginaDTO<PanelSolicitudDTO>> solicitudes(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="10") int tamano,@RequestParam(required=false) String busqueda,@RequestParam(required=false) String estado,
        @RequestParam(required=false) String etapa,@RequestParam(defaultValue="recientes") String orden,@RequestParam(required=false) Long entidadId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.solicitudes(pagina,tamano,busqueda,estado,etapa,orden,entidadId));
    }
    @GetMapping("/apelaciones")
    @Operation(summary="Consultar página y agregados TTAIP del actor actual",description="Titular o entidad desde la identidad actual; TTAIP/administración conservan su alcance autorizado. Plazos de primera calificación y subsanación cuando consta el inicio correspondiente.")
    public ResponseEntity<PanelPaginaDTO<PanelApelacionDTO>> apelaciones(@RequestParam(defaultValue="0") int pagina,
        @RequestParam(defaultValue="10") int tamano,@RequestParam(required=false) String busqueda,@RequestParam(required=false) String estado,
        @RequestParam(required=false) String etapa,@RequestParam(defaultValue="recientes") String orden,@RequestParam(required=false) Long entidadId,
        @RequestParam(required=false) String sala) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.apelaciones(pagina,tamano,busqueda,estado,etapa,orden,entidadId,sala));
    }
}
