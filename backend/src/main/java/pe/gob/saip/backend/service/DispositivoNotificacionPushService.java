package pe.gob.saip.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DispositivoNotificacionPushDTO;
import pe.gob.saip.backend.model.dto.EstadoPushNotificacionesDTO;
import pe.gob.saip.backend.model.dto.RegistrarDispositivoPushRequest;
import pe.gob.saip.backend.model.dto.RevocarDispositivoPushActualRequest;
import pe.gob.saip.backend.model.entity.DispositivoNotificacionPush;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.DispositivoNotificacionPushRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.security.IdentidadUsuario;
import pe.gob.saip.backend.service.notification.FcmPushProveedorNotificacion;
import pe.gob.saip.backend.service.notification.TokenPushProtector;

@Service
public class DispositivoNotificacionPushService {

    private static final String ROLE_ADMINISTRADOR = "ROLE_ADMINISTRADOR";

    private final DispositivoNotificacionPushRepository dispositivoRepository;
    private final UsuarioRepository usuarioRepository;
    private final TokenPushProtector tokenProtector;
    private final FcmPushProveedorNotificacion fcmProveedor;

    public DispositivoNotificacionPushService(
            DispositivoNotificacionPushRepository dispositivoRepository,
            UsuarioRepository usuarioRepository,
            TokenPushProtector tokenProtector,
            FcmPushProveedorNotificacion fcmProveedor) {
        this.dispositivoRepository = dispositivoRepository;
        this.usuarioRepository = usuarioRepository;
        this.tokenProtector = tokenProtector;
        this.fcmProveedor = fcmProveedor;
    }

    @Transactional
    public DispositivoNotificacionPushDTO registrar(RegistrarDispositivoPushRequest request) {
        Usuario usuario = obtenerUsuarioActual();
        validarFlavor(usuario, request.appFlavor());
        String tokenNormalizado = request.token().trim();
        String tokenHash = tokenProtector.hash(tokenNormalizado);
        String deviceIdHash = request.deviceIdHash().toLowerCase();

        dispositivoRepository
                .findByUsuario_IdUsuarioAndDeviceIdHashAndAppFlavorAndEstado(
                        usuario.getIdUsuario(),
                        deviceIdHash,
                        request.appFlavor(),
                        DispositivoNotificacionPush.EstadoDispositivo.ACTIVO)
                .stream()
                .filter(dispositivo -> !tokenHash.equals(dispositivo.getTokenHash()))
                .forEach(dispositivo -> revocar(dispositivo, "Token reemplazado por renovación FCM"));

        DispositivoNotificacionPush dispositivo = dispositivoRepository.findByTokenHash(tokenHash)
                .orElseGet(DispositivoNotificacionPush::new);
        dispositivo.setUsuario(usuario);
        dispositivo.setTipoUsuario(usuario.getTipoUsuario());
        dispositivo.setAppFlavor(request.appFlavor());
        dispositivo.setPlataforma(request.plataforma());
        dispositivo.setTokenHash(tokenHash);
        dispositivo.setTokenCifrado(tokenProtector.cifrar(tokenNormalizado));
        dispositivo.setDeviceIdHash(deviceIdHash);
        dispositivo.setEstado(DispositivoNotificacionPush.EstadoDispositivo.ACTIVO);
        dispositivo.setAppVersion(limpiar(request.appVersion()));
        dispositivo.setBuildType(limpiar(request.buildType()));
        dispositivo.setFechaRevocacion(null);
        dispositivo.setTrazabilidad(anexar(
                dispositivo.getTrazabilidad(),
                "Token push registrado o actualizado para el usuario autenticado"));
        return toDto(dispositivoRepository.save(dispositivo));
    }

    @Transactional(readOnly = true)
    public List<DispositivoNotificacionPushDTO> listarMios() {
        Usuario usuario = obtenerUsuarioActual();
        return dispositivoRepository.findByUsuario_IdUsuarioOrderByFechaActualizacionDesc(usuario.getIdUsuario())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void revocarPorId(Long dispositivoId) {
        Usuario usuario = obtenerUsuarioActual();
        DispositivoNotificacionPush dispositivo = dispositivoRepository.findById(dispositivoId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Dispositivo push no encontrado"));
        if (!usuario.getIdUsuario().equals(dispositivo.getUsuario().getIdUsuario()) && !esAdministrador()) {
            throw new AccessDeniedException("El dispositivo push no pertenece al usuario autenticado");
        }
        revocar(dispositivo, "Token push revocado explícitamente");
    }

    @Transactional
    public void revocarActual(RevocarDispositivoPushActualRequest request) {
        Usuario usuario = obtenerUsuarioActual();
        List<DispositivoNotificacionPush> activos = dispositivoRepository
                .findByUsuario_IdUsuarioAndDeviceIdHashAndEstado(
                        usuario.getIdUsuario(),
                        request.deviceIdHash().toLowerCase(),
                        DispositivoNotificacionPush.EstadoDispositivo.ACTIVO);
        activos.forEach(dispositivo -> revocar(dispositivo, "Token push revocado durante cierre de sesión"));
    }

    public EstadoPushNotificacionesDTO obtenerEstadoSeguro() {
        return new EstadoPushNotificacionesDTO(
                fcmProveedor.nombre(),
                fcmProveedor.estadoSeguro(),
                true,
                fcmProveedor.credencialesExternasConfiguradas(),
                tokenProtector.cifradoDisponible(),
                "El adapter no expone tokens ni credenciales. La entrega FCM real requiere integración Firebase Admin.");
    }

    private void revocar(DispositivoNotificacionPush dispositivo, String motivo) {
        dispositivo.setEstado(DispositivoNotificacionPush.EstadoDispositivo.REVOCADO);
        dispositivo.setFechaRevocacion(LocalDateTime.now());
        dispositivo.setTrazabilidad(anexar(dispositivo.getTrazabilidad(), motivo));
        dispositivoRepository.save(dispositivo);
    }

    private void validarFlavor(Usuario usuario, DispositivoNotificacionPush.AppFlavor appFlavor) {
        boolean coincide = switch (usuario.getTipoUsuario()) {
            case CIUDADANO -> appFlavor == DispositivoNotificacionPush.AppFlavor.CIUDADANO;
            case FUNCIONARIO -> appFlavor == DispositivoNotificacionPush.AppFlavor.FUNCIONARIO;
            case TTAIP -> appFlavor == DispositivoNotificacionPush.AppFlavor.TTAIP;
            case ADMINISTRADOR -> false;
        };
        if (!coincide) {
            throw new AccessDeniedException("El flavor mobile no corresponde al rol autenticado");
        }
    }

    private Usuario obtenerUsuarioActual() {
        Authentication authentication = autenticacionActual();
        return usuarioRepository.findById(IdentidadUsuario.usuarioId(authentication))
                .orElseThrow(() -> new AccessDeniedException(
                        "No existe un usuario asociado a la identidad autenticada"));
    }

    private boolean esAdministrador() {
        return autenticacionActual().getAuthorities().stream()
                .anyMatch(authority -> ROLE_ADMINISTRADOR.equals(authority.getAuthority()));
    }

    private Authentication autenticacionActual() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Se requiere autenticación para operar dispositivos push");
        }
        return authentication;
    }

    private DispositivoNotificacionPushDTO toDto(DispositivoNotificacionPush dispositivo) {
        return new DispositivoNotificacionPushDTO(
                dispositivo.getIdDispositivoPush(),
                dispositivo.getTipoUsuario(),
                dispositivo.getAppFlavor(),
                dispositivo.getPlataforma(),
                fingerprint(dispositivo.getTokenHash()),
                fingerprint(dispositivo.getDeviceIdHash()),
                dispositivo.getEstado(),
                dispositivo.getAppVersion(),
                dispositivo.getBuildType(),
                dispositivo.getFechaRegistro(),
                dispositivo.getFechaActualizacion(),
                dispositivo.getFechaRevocacion());
    }

    private String fingerprint(String value) {
        if (value == null || value.length() <= 12) {
            return value;
        }
        return value.substring(value.length() - 12);
    }

    private String limpiar(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String anexar(String actual, String nuevoValor) {
        return actual == null || actual.isBlank() ? nuevoValor : actual + System.lineSeparator() + nuevoValor;
    }
}
