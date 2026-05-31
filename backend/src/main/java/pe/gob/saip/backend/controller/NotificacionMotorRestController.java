package pe.gob.saip.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.gob.saip.backend.model.dto.EstadoMotorNotificacionesDTO;
import pe.gob.saip.backend.service.MotorNotificacionesService;

@RestController
@RequestMapping("/api/notificaciones/motor")
@Tag(name = "Motor de notificaciones", description = "Estado seguro del proveedor transversal SAIP/TTAIP")
public class NotificacionMotorRestController {

    private final MotorNotificacionesService motorNotificacionesService;

    public NotificacionMotorRestController(MotorNotificacionesService motorNotificacionesService) {
        this.motorNotificacionesService = motorNotificacionesService;
    }

    @Operation(summary = "Consultar estado seguro del motor de notificaciones")
    @GetMapping("/estado")
    public ResponseEntity<EstadoMotorNotificacionesDTO> obtenerEstadoSeguro() {
        return ResponseEntity.ok(motorNotificacionesService.obtenerEstadoSeguro());
    }
}
