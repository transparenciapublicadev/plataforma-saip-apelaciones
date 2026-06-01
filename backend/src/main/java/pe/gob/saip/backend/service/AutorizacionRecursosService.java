package pe.gob.saip.backend.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;

@Service
@Transactional(readOnly = true)
public class AutorizacionRecursosService {

    private static final String ROLE_FUNCIONARIO = "ROLE_FUNCIONARIO";
    private static final String ROLE_TTAIP = "ROLE_TTAIP";
    private static final String ROLE_ADMINISTRADOR = "ROLE_ADMINISTRADOR";

    private final FuncionarioRepository funcionarioRepository;
    private final SolicitudRepository solicitudRepository;
    private final ExpedienteTtaipRepository expedienteRepository;
    private final ElevacionApelacionTtaipRepository elevacionRepository;

    public AutorizacionRecursosService(
            FuncionarioRepository funcionarioRepository,
            SolicitudRepository solicitudRepository,
            ExpedienteTtaipRepository expedienteRepository,
            ElevacionApelacionTtaipRepository elevacionRepository) {
        this.funcionarioRepository = funcionarioRepository;
        this.solicitudRepository = solicitudRepository;
        this.expedienteRepository = expedienteRepository;
        this.elevacionRepository = elevacionRepository;
    }

    public void verificarSolicitudInstitucional(Long solicitudId) {
        if (!requiereValidacionDeEntidad()) {
            return;
        }
        Solicitud solicitud = solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Solicitud SAIP no encontrada con ID: " + solicitudId));
        verificarEntidadDelFuncionario(solicitud.getEntidad());
    }

    public void verificarExpedienteTtaipInstitucional(Long expedienteId) {
        if (!requiereValidacionDeEntidad()) {
            return;
        }
        ExpedienteTtaip expediente = expedienteRepository.findById(expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Expediente TTAIP no encontrado con ID: " + expedienteId));
        Entidad entidad = expediente.getApelacion() == null
                ? null
                : expediente.getApelacion().getEntidadApeladaEfectiva();
        verificarEntidadDelFuncionario(entidad);
    }

    public void verificarEntidadInstitucional(Long entidadId) {
        if (!requiereValidacionDeEntidad()) {
            return;
        }
        Funcionario funcionario = obtenerFuncionarioActual();
        if (funcionario.getEntidad() == null || !funcionario.getEntidad().getId().equals(entidadId)) {
            throw new AccessDeniedException("La entidad solicitada no corresponde al funcionario autenticado");
        }
    }

    public void verificarElevacionInstitucional(Long apelacionId) {
        if (!requiereValidacionDeEntidad()) {
            return;
        }
        ElevacionApelacionTtaip elevacion = elevacionRepository.findByApelacion_IdApelacion(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Elevación no encontrada para la apelación ID: " + apelacionId));
        verificarEntidadDelFuncionario(elevacion.getEntidadOrigen());
    }

    private boolean requiereValidacionDeEntidad() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Se requiere autenticación para validar ownership");
        }
        if (hasRole(authentication, ROLE_ADMINISTRADOR) || hasRole(authentication, ROLE_TTAIP)) {
            return false;
        }
        if (hasRole(authentication, ROLE_FUNCIONARIO)) {
            return true;
        }
        throw new AccessDeniedException("El rol autenticado no puede operar recursos institucionales");
    }

    private void verificarEntidadDelFuncionario(Entidad entidad) {
        Funcionario funcionario = obtenerFuncionarioActual();
        if (entidad == null
                || funcionario.getEntidad() == null
                || !funcionario.getEntidad().getId().equals(entidad.getId())) {
            throw new AccessDeniedException("El recurso no corresponde a la entidad del funcionario autenticado");
        }
    }

    private Funcionario obtenerFuncionarioActual() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return funcionarioRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException(
                        "No existe un funcionario asociado al usuario autenticado"));
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> role.equals(authority.getAuthority()));
    }
}
