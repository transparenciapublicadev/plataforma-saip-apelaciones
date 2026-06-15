package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.model.dto.DispositivoNotificacionPushDTO;
import pe.gob.saip.backend.model.dto.EstadoPushNotificacionesDTO;
import pe.gob.saip.backend.model.dto.RegistrarDispositivoPushRequest;
import pe.gob.saip.backend.model.dto.RevocarDispositivoPushActualRequest;
import pe.gob.saip.backend.service.DispositivoNotificacionPushService;

@RestController
@RequestMapping("/api/notificaciones/push")
@Tag(name = "Dispositivos push", description = "Registro seguro de tokens FCM para apps Android autenticadas")
public class DispositivoNotificacionPushRestController {

    private final DispositivoNotificacionPushService dispositivoService;

    public DispositivoNotificacionPushRestController(DispositivoNotificacionPushService dispositivoService) {
        this.dispositivoService = dispositivoService;
    }

    @Operation(summary = "Registrar o renovar el token FCM del dispositivo autenticado")
    @PostMapping("/tokens")
    public ResponseEntity<DispositivoNotificacionPushDTO> registrar(
            @Valid @RequestBody RegistrarDispositivoPushRequest request) {
        org.springframework.security.core.Authentication authentication =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new org.springframework.security.access.AccessDeniedException("Se requiere autenticación para operar dispositivos push");
        }
        String email = authentication.getName();
        return ResponseEntity.status(HttpStatus.CREATED).body(dispositivoService.registrar(request, email));
    }

    @Operation(summary = "Listar los dispositivos push del usuario autenticado sin exponer tokens")
    @GetMapping("/tokens/mios")
    public ResponseEntity<List<DispositivoNotificacionPushDTO>> listarMios() {
        return ResponseEntity.ok(dispositivoService.listarMios());
    }

    @Operation(summary = "Revocar un dispositivo push propio")
    @DeleteMapping("/tokens/{dispositivoId}")
    public ResponseEntity<Void> revocarPorId(@PathVariable Long dispositivoId) {
        dispositivoService.revocarPorId(dispositivoId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Revocar tokens activos del dispositivo autenticado durante cierre de sesión")
    @PostMapping("/tokens/revocar-actual")
    public ResponseEntity<Void> revocarActual(@Valid @RequestBody RevocarDispositivoPushActualRequest request) {
        dispositivoService.revocarActual(request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Consultar estado seguro del adapter FCM")
    @GetMapping("/estado")
    public ResponseEntity<EstadoPushNotificacionesDTO> obtenerEstadoSeguro() {
        return ResponseEntity.ok(dispositivoService.obtenerEstadoSeguro());
    }
}
