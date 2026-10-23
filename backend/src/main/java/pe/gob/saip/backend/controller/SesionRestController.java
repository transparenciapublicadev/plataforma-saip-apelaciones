package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.service.SesionJwtService;

/** Logs out only the issuance already verified by the security filter. */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticación")
public class SesionRestController {
    private final SesionJwtService sesiones;

    public SesionRestController(SesionJwtService sesiones) {
        this.sesiones = sesiones;
    }

    @PostMapping("/logout")
    @Operation(operationId = "cerrarSesionActual", summary = "Invalidar el JWT de la sesión actual",
            description = "Deriva usuario y jti del Bearer verificado. No invalida otros logins ni incrementa authVersion. "
                    + "Devuelve 204 tras persistir la revocación; un Bearer ya revocado, inválido o expirado devuelve 401. "
                    + "Peticiones concurrentes pueden devolver 204 o 401; las revocaciones no se duplican.")
    @SecurityRequirement(name = "bearerAuth")
    @ApiResponse(responseCode = "204", description = "Revocación de esta sesión confirmada", content = @Content)
    @ApiResponse(responseCode = "401", description = "Bearer ausente, inválido, expirado o ya revocado",
            content = @Content(mediaType = "application/problem+json", schema = @Schema(implementation = ProblemDetail.class)))
    public ResponseEntity<Void> cerrarSesionActual(Authentication autenticacion) {
        sesiones.cerrarSesionActual(autenticacion);
        return ResponseEntity.noContent().build();
    }
}
