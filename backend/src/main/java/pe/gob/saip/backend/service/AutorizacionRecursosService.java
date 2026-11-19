package pe.gob.saip.backend.service;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.security.IdentidadUsuario;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.ApelacionRepository;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.repository.ElevacionApelacionTtaipRepository;
import pe.gob.saip.backend.repository.EncauzamientoSolicitudRepository;
import pe.gob.saip.backend.repository.ExpedienteTtaipRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.RespuestaRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class AutorizacionRecursosService {

    private static final String ROLE_CIUDADANO = "ROLE_CIUDADANO";
    private static final String ROLE_FUNCIONARIO = "ROLE_FUNCIONARIO";
    private static final String ROLE_TTAIP = "ROLE_TTAIP";
    private static final String ROLE_ADMINISTRADOR = "ROLE_ADMINISTRADOR";

    private final UsuarioRepository usuarioRepository;
    private final CiudadanoRepository ciudadanoRepository;
    private final FuncionarioRepository funcionarioRepository;
    private final SolicitudRepository solicitudRepository;
    private final RespuestaRepository respuestaRepository;
    private final ApelacionRepository apelacionRepository;
    private final ExpedienteTtaipRepository expedienteRepository;
    private final ElevacionApelacionTtaipRepository elevacionRepository;
    private final EncauzamientoSolicitudRepository encauzamientoRepository;

    public AutorizacionRecursosService(
            UsuarioRepository usuarioRepository,
            CiudadanoRepository ciudadanoRepository,
            FuncionarioRepository funcionarioRepository,
            SolicitudRepository solicitudRepository,
            RespuestaRepository respuestaRepository,
            ApelacionRepository apelacionRepository,
            ExpedienteTtaipRepository expedienteRepository,
            ElevacionApelacionTtaipRepository elevacionRepository,
            EncauzamientoSolicitudRepository encauzamientoRepository) {
        this.usuarioRepository = usuarioRepository;
        this.ciudadanoRepository = ciudadanoRepository;
        this.funcionarioRepository = funcionarioRepository;
        this.solicitudRepository = solicitudRepository;
        this.respuestaRepository = respuestaRepository;
        this.apelacionRepository = apelacionRepository;
        this.expedienteRepository = expedienteRepository;
        this.elevacionRepository = elevacionRepository;
        this.encauzamientoRepository = encauzamientoRepository;
    }

    public void verificarUsuarioActualOAdministrador(Long usuarioId) {
        if (esAdministrador()) {
            return;
        }
        if (!obtenerUsuarioActual().getIdUsuario().equals(usuarioId)) {
            throw new AccessDeniedException("Solo puede consultar los datos del usuario autenticado");
        }
    }

    public void verificarCiudadanoActualOAdministrador(Long ciudadanoId) {
        if (esAdministrador()) {
            return;
        }
        verificarCiudadanoActual(ciudadanoId);
    }

    public void verificarCiudadanoActualOPrivilegiado(Long ciudadanoId) {
        if (esAdministradorOTtaip()) {
            return;
        }
        verificarCiudadanoActual(ciudadanoId);
    }

    public List<Ciudadano> filtrarCiudadanosAccesibles(List<Ciudadano> ciudadanos) {
        if (esAdministrador()) {
            return ciudadanos;
        }
        Ciudadano ciudadanoActual = obtenerCiudadanoActual();
        return ciudadanos.stream()
                .filter(ciudadano -> ciudadano.getId().equals(ciudadanoActual.getId()))
                .toList();
    }

    public void verificarSolicitudAccesible(Long solicitudId) {
        verificarSolicitudAccesible(buscarSolicitud(solicitudId));
    }

    /** Restricts citizen submissions to the owner of the SAIP request, without privileged bypass. */
    public void verificarSolicitudCiudadana(Long solicitudId) {
        Solicitud solicitud = buscarSolicitud(solicitudId);
        if (solicitud.getCiudadano() == null) {
            throw new AccessDeniedException("La solicitud no corresponde al ciudadano autenticado");
        }
        verificarCiudadanoActual(solicitud.getCiudadano().getId());
    }

    /** Read of the case file: the current entity, or an entity that sent or received its referral. */
    public void verificarLecturaExpediente(Solicitud solicitud) {
        if (esAdministradorOTtaip() || puedeAccederSolicitud(solicitud)) {
            return;
        }
        if (esFuncionario() && solicitud.getId() != null && encauzamientoRelacionado(solicitud.getId())) {
            return;
        }
        throw new AccessDeniedException("La solicitud SAIP no corresponde al usuario autenticado");
    }

    public void verificarSolicitudAccesible(Solicitud solicitud) {
        if (esAdministradorOTtaip()) {
            return;
        }
        if (esFuncionario()) {
            verificarEntidadDelFuncionario(solicitud.getEntidad());
            return;
        }
        if (esCiudadano() && solicitud.getCiudadano() != null
                && solicitud.getCiudadano().getId().equals(obtenerCiudadanoActual().getId())) {
            return;
        }
        throw new AccessDeniedException("La solicitud SAIP no corresponde al usuario autenticado");
    }

    public List<Solicitud> filtrarSolicitudesAccesibles(List<Solicitud> solicitudes) {
        return solicitudes.stream()
                .filter(this::puedeAccederSolicitud)
                .toList();
    }

    public void verificarSolicitudInstitucional(Long solicitudId) {
        if (esAdministrador()) {
            return;
        }
        if (!esFuncionario()) {
            throw new AccessDeniedException("El rol autenticado no puede operar solicitudes institucionales");
        }
        verificarEntidadDelFuncionario(buscarSolicitud(solicitudId).getEntidad());
    }

    public void verificarTrazabilidadEncauzamientoAccesible(Long solicitudId) {
        if (esAdministradorOTtaip()) {
            return;
        }
        Solicitud solicitud = buscarSolicitud(solicitudId);
        if (esCiudadano() && solicitud.getCiudadano() != null
                && solicitud.getCiudadano().getId().equals(obtenerCiudadanoActual().getId())) {
            return;
        }
        if (esFuncionario()) {
            Long entidadFuncionarioId = obtenerEntidadFuncionarioActual();
            if (solicitud.getEntidad() != null
                    && entidadFuncionarioId.equals(solicitud.getEntidad().getId())) {
                return;
            }
            boolean entidadRelacionada = encauzamientoRepository
                    .findBySolicitud_IdSolicitudOrderByFechaEncauzamientoDesc(solicitudId)
                    .stream()
                    .anyMatch(encauzamiento -> entidadCoincide(encauzamiento.getEntidadOrigen(), entidadFuncionarioId)
                            || entidadCoincide(encauzamiento.getEntidadDestino(), entidadFuncionarioId));
            if (entidadRelacionada) {
                return;
            }
        }
        throw new AccessDeniedException("La trazabilidad de encauzamiento no corresponde al usuario autenticado");
    }

    public void verificarRespuestaAccesible(Long respuestaId) {
        Respuesta respuesta = respuestaRepository.findById(respuestaId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Respuesta no encontrada con ID: " + respuestaId));
        verificarSolicitudAccesible(respuesta.getSolicitud());
    }

    public List<Respuesta> filtrarRespuestasAccesibles(List<Respuesta> respuestas) {
        return respuestas.stream()
                .filter(respuesta -> puedeAccederSolicitud(respuesta.getSolicitud()))
                .toList();
    }

    public void verificarFuncionarioPuedeActuar(Long funcionarioId) {
        if (esAdministrador()) {
            return;
        }
        if (funcionarioId == null || !obtenerFuncionarioActual().getId().equals(funcionarioId)) {
            throw new AccessDeniedException("El funcionario autenticado solo puede actuar con su propia identidad");
        }
    }

    public void verificarFuncionarioConsultable(Long funcionarioId) {
        if (esAdministradorOTtaip()) {
            return;
        }
        Funcionario funcionario = funcionarioRepository.findById(funcionarioId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Funcionario no encontrado con ID: " + funcionarioId));
        verificarEntidadDelFuncionario(funcionario.getEntidad());
    }

    public void verificarFuncionarioEditable(Long funcionarioId) {
        verificarFuncionarioPuedeActuar(funcionarioId);
    }

    public List<Funcionario> filtrarFuncionariosAccesibles(List<Funcionario> funcionarios) {
        if (esAdministradorOTtaip()) {
            return funcionarios;
        }
        Long entidadId = obtenerEntidadFuncionarioActual();
        return funcionarios.stream()
                .filter(funcionario -> funcionario.getEntidad() != null
                        && entidadId.equals(funcionario.getEntidad().getId()))
                .toList();
    }

    public void verificarApelacionAccesible(Long apelacionId) {
        verificarApelacionAccesible(buscarApelacion(apelacionId));
    }

    public void verificarApelacionAccesible(Apelacion apelacion) {
        if (esAdministradorOTtaip()) {
            return;
        }
        if (esFuncionario()) {
            verificarEntidadDelFuncionario(apelacion.getEntidadApeladaEfectiva());
            return;
        }
        if (esCiudadano() && apelacion.getCiudadano() != null
                && apelacion.getCiudadano().getId().equals(obtenerCiudadanoActual().getId())) {
            return;
        }
        throw new AccessDeniedException("La apelación no corresponde al usuario autenticado");
    }

    public void verificarApelacionCiudadanaOAdministrador(Long apelacionId) {
        if (esAdministrador()) {
            return;
        }
        Apelacion apelacion = buscarApelacion(apelacionId);
        if (esCiudadano() && apelacion.getCiudadano() != null
                && apelacion.getCiudadano().getId().equals(obtenerCiudadanoActual().getId())) {
            return;
        }
        throw new AccessDeniedException("La apelación no corresponde al ciudadano autenticado");
    }

    public List<Apelacion> filtrarApelacionesAccesibles(List<Apelacion> apelaciones) {
        return apelaciones.stream()
                .filter(this::puedeAccederApelacion)
                .toList();
    }

    public void verificarExpedienteTtaipInstitucional(Long expedienteId) {
        if (esAdministradorOTtaip()) {
            return;
        }
        if (!esFuncionario()) {
            throw new AccessDeniedException("El rol autenticado no puede consultar expedientes institucionales");
        }
        ExpedienteTtaip expediente = expedienteRepository.findById(expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Expediente TTAIP no encontrado con ID: " + expedienteId));
        Entidad entidad = expediente.getApelacion() == null
                ? null
                : expediente.getApelacion().getEntidadApeladaEfectiva();
        verificarEntidadDelFuncionario(entidad);
    }

    public void verificarExpedienteTtaipAccesible(Long expedienteId) {
        ExpedienteTtaip expediente = expedienteRepository.findById(expedienteId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Expediente TTAIP no encontrado con ID: " + expedienteId));
        verificarApelacionAccesible(expediente.getApelacion());
    }

    public void verificarTtaipOAdministrador() {
        if (!esAdministradorOTtaip()) {
            throw new AccessDeniedException("La operación documental requiere rol TTAIP o administrador");
        }
    }

    public void verificarAdministrador() {
        if (!esAdministrador()) {
            throw new AccessDeniedException("La eliminación documental requiere rol administrador");
        }
    }

    public Usuario obtenerUsuarioActual() {
        Long usuarioId = IdentidadUsuario.usuarioId(obtenerAutenticacion());
        return usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new AccessDeniedException(
                        "No existe un usuario asociado a la identidad autenticada"));
    }

    public void verificarEntidadInstitucional(Long entidadId) {
        if (esAdministradorOTtaip()) {
            return;
        }
        if (!esFuncionario() || !obtenerEntidadFuncionarioActual().equals(entidadId)) {
            throw new AccessDeniedException("La entidad solicitada no corresponde al funcionario autenticado");
        }
    }

    public void verificarElevacionInstitucional(Long apelacionId) {
        if (esAdministrador()) {
            return;
        }
        if (!esFuncionario()) {
            throw new AccessDeniedException("El rol autenticado no puede operar elevaciones institucionales");
        }
        ElevacionApelacionTtaip elevacion = elevacionRepository.findByApelacion_IdApelacion(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Elevación no encontrada para la apelación ID: " + apelacionId));
        verificarEntidadDelFuncionario(elevacion.getEntidadOrigen());
    }

    public boolean esFuncionario() {
        return hasRole(obtenerAutenticacion(), ROLE_FUNCIONARIO);
    }

    public boolean esAdministradorOTtaip() {
        Authentication authentication = obtenerAutenticacion();
        return hasRole(authentication, ROLE_ADMINISTRADOR) || hasRole(authentication, ROLE_TTAIP);
    }

    private boolean esAdministrador() {
        return hasRole(obtenerAutenticacion(), ROLE_ADMINISTRADOR);
    }

    private boolean esCiudadano() {
        return hasRole(obtenerAutenticacion(), ROLE_CIUDADANO);
    }

    private boolean encauzamientoRelacionado(Long solicitudId) {
        Long entidadFuncionarioId = obtenerEntidadFuncionarioActual();
        return encauzamientoRepository
                .findBySolicitud_IdSolicitudOrderByFechaEncauzamientoDesc(solicitudId)
                .stream()
                .anyMatch(encauzamiento -> entidadCoincide(encauzamiento.getEntidadOrigen(), entidadFuncionarioId)
                        || entidadCoincide(encauzamiento.getEntidadDestino(), entidadFuncionarioId));
    }

    private boolean puedeAccederSolicitud(Solicitud solicitud) {
        try {
            verificarSolicitudAccesible(solicitud);
            return true;
        } catch (AccessDeniedException exception) {
            return false;
        }
    }

    private boolean puedeAccederApelacion(Apelacion apelacion) {
        try {
            verificarApelacionAccesible(apelacion);
            return true;
        } catch (AccessDeniedException exception) {
            return false;
        }
    }

    private void verificarCiudadanoActual(Long ciudadanoId) {
        if (!esCiudadano() || !obtenerCiudadanoActual().getId().equals(ciudadanoId)) {
            throw new AccessDeniedException("Solo puede operar recursos del ciudadano autenticado");
        }
    }

    private Solicitud buscarSolicitud(Long solicitudId) {
        return solicitudRepository.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Solicitud SAIP no encontrada con ID: " + solicitudId));
    }

    private Apelacion buscarApelacion(Long apelacionId) {
        return apelacionRepository.findById(apelacionId)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Apelación no encontrada con ID: " + apelacionId));
    }

    private void verificarEntidadDelFuncionario(Entidad entidad) {
        Long entidadFuncionarioId = obtenerEntidadFuncionarioActual();
        if (entidad == null || !entidadFuncionarioId.equals(entidad.getId())) {
            throw new AccessDeniedException("El recurso no corresponde a la entidad del funcionario autenticado");
        }
    }

    private boolean entidadCoincide(Entidad entidad, Long entidadId) {
        return entidad != null && entidadId.equals(entidad.getId());
    }

    private Long obtenerEntidadFuncionarioActual() {
        Funcionario funcionario = obtenerFuncionarioActual();
        if (funcionario.getEntidad() == null) {
            throw new AccessDeniedException("El funcionario autenticado no tiene entidad asociada");
        }
        return funcionario.getEntidad().getId();
    }

    private Ciudadano obtenerCiudadanoActual() {
        Long usuarioId = IdentidadUsuario.usuarioId(obtenerAutenticacion());
        return ciudadanoRepository.findById(usuarioId)
                .orElseThrow(() -> new AccessDeniedException(
                        "No existe un ciudadano asociado a la identidad autenticada"));
    }

    private Funcionario obtenerFuncionarioActual() {
        Long usuarioId = IdentidadUsuario.usuarioId(obtenerAutenticacion());
        return funcionarioRepository.findById(usuarioId)
                .orElseThrow(() -> new AccessDeniedException(
                        "No existe un funcionario asociado a la identidad autenticada"));
    }

    private Authentication obtenerAutenticacion() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Se requiere autenticación para validar ownership");
        }
        return authentication;
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> role.equals(authority.getAuthority()));
    }
}
