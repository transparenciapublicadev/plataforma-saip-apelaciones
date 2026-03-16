package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.CrearRespuestaRequest;
import pe.gob.saip.backend.model.dto.RespuestaDTO;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Respuesta;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.repository.RespuestaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class RespuestaService {

    private final RespuestaRepository respuestaRepository;
    private final SolicitudService solicitudService;
    private final FuncionarioService funcionarioService;

    public RespuestaService(RespuestaRepository respuestaRepository,
                            SolicitudService solicitudService,
                            FuncionarioService funcionarioService) {
        this.respuestaRepository = respuestaRepository;
        this.solicitudService = solicitudService;
        this.funcionarioService = funcionarioService;
    }

    @Transactional(readOnly = true)
    public List<Respuesta> obtenerTodasLasRespuestas() {
        return respuestaRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Respuesta> obtenerRespuestaPorId(Long id) {
        return respuestaRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Respuesta> obtenerRespuestaPorSolicitud(Long solicitudId) {
        return respuestaRepository.findBySolicitud_IdSolicitud(solicitudId);
    }

    @Transactional
    public void guardarRespuesta(Respuesta respuesta) {
        respuestaRepository.save(respuesta);
    }

    @Transactional
    public void save(Respuesta respuesta) {
        respuestaRepository.save(respuesta);
    }

    @Transactional
    public void eliminarRespuesta(Long id) {
        respuestaRepository.deleteById(id);
    }

    // ============================================================
    // DOMAIN METHODS — Lógica de negocio extraída del controller
    // ============================================================

    @Transactional
    public RespuestaDTO crearRespuesta(CrearRespuestaRequest request) {
        Solicitud solicitud = buscarSolicitud(request.solicitudId());
        validarSinRespuesta(solicitud);

        Respuesta respuesta = new Respuesta();
        respuesta.setSolicitud(solicitud);
        respuesta.setContenido(request.contenido());
        respuesta.setFechaRespuesta(LocalDateTime.now());
        asignarFuncionario(respuesta, request.funcionarioId());
        aplicarTipoRespuesta(respuesta, solicitud, request);

        respuestaRepository.save(respuesta);
        solicitud.setRespuesta(respuesta);
        solicitudService.save(solicitud);

        return RespuestaDTO.from(respuesta);
    }

    @Transactional
    public RespuestaDTO aceptarSolicitud(CrearRespuestaRequest request) {
        Solicitud solicitud = buscarSolicitud(request.solicitudId());
        validarSinRespuesta(solicitud);
        Funcionario funcionario = buscarFuncionario(request.funcionarioId());

        Respuesta respuesta = new Respuesta();
        respuesta.setSolicitud(solicitud);
        respuesta.setFuncionario(funcionario);
        respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.ENTREGA_TOTAL);
        respuesta.setDecision("aceptar");
        respuesta.setFechaRespuesta(LocalDateTime.now());
        respuesta.setContenido(construirContenidoAceptacion(request));

        respuestaRepository.save(respuesta);
        solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
        solicitud.setRespuesta(respuesta);
        solicitudService.save(solicitud);

        return RespuestaDTO.from(respuesta);
    }

    @Transactional
    public RespuestaDTO denegarSolicitud(CrearRespuestaRequest request) {
        Solicitud solicitud = buscarSolicitud(request.solicitudId());
        validarSinRespuesta(solicitud);
        Funcionario funcionario = buscarFuncionario(request.funcionarioId());

        Respuesta respuesta = new Respuesta();
        respuesta.setSolicitud(solicitud);
        respuesta.setFuncionario(funcionario);
        respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.DENEGACION_TOTAL);
        respuesta.setDecision("denegar");
        respuesta.setContenido(request.contenido());
        respuesta.setCausalDenegatoria(request.causalDenegatoria());
        respuesta.setFundamentoLegal(request.fundamentoLegal());
        respuesta.setFechaRespuesta(LocalDateTime.now());

        respuestaRepository.save(respuesta);
        solicitud.setEstado(Solicitud.EstadoSolicitud.DENEGADA);
        solicitud.setRespuesta(respuesta);
        solicitudService.save(solicitud);

        return RespuestaDTO.from(respuesta);
    }

    // ============================================================
    // HELPERS INTERNOS
    // ============================================================

    private Solicitud buscarSolicitud(Long solicitudId) {
        return solicitudService.findById(solicitudId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud no encontrada con ID: " + solicitudId));
    }

    private Funcionario buscarFuncionario(Long funcionarioId) {
        return funcionarioService.obtenerFuncionarioPorId(funcionarioId)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario no encontrado con ID: " + funcionarioId));
    }

    private void validarSinRespuesta(Solicitud solicitud) {
        if (solicitud.getRespuesta() != null) {
            throw new IllegalArgumentException("La solicitud ya tiene una respuesta");
        }
    }

    private void asignarFuncionario(Respuesta respuesta, Long funcionarioId) {
        if (funcionarioId != null) {
            funcionarioService.obtenerFuncionarioPorId(funcionarioId)
                    .ifPresent(respuesta::setFuncionario);
        }
    }

    private void aplicarTipoRespuesta(Respuesta respuesta, Solicitud solicitud, CrearRespuestaRequest request) {
        String tipo = request.tipoRespuesta();
        if ("SILENCIO_ADMINISTRATIVO".equalsIgnoreCase(tipo)) {
            throw new IllegalArgumentException("Silencio administrativo se aplica automaticamente y no se registra manualmente");
        }

        if ("ENTREGA_TOTAL".equalsIgnoreCase(tipo) || "ACEPTADA".equalsIgnoreCase(tipo)) {
            respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.ENTREGA_TOTAL);
            solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
        } else if ("ENTREGA_PARCIAL".equalsIgnoreCase(tipo)) {
            respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.ENTREGA_PARCIAL);
            solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
        } else if ("DENEGACION_TOTAL".equalsIgnoreCase(tipo) || "DENEGADA".equalsIgnoreCase(tipo)) {
            respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.DENEGACION_TOTAL);
            respuesta.setCausalDenegatoria(request.causalDenegatoria());
            respuesta.setFundamentoLegal(request.fundamentoLegal());
            solicitud.setEstado(Solicitud.EstadoSolicitud.DENEGADA);
        } else {
            respuesta.setTipoRespuesta(Respuesta.TipoRespuesta.ENTREGA_TOTAL);
            solicitud.setEstado(Solicitud.EstadoSolicitud.RESPONDIDA);
        }
    }

    private String construirContenidoAceptacion(CrearRespuestaRequest request) {
        StringBuilder contenido = new StringBuilder();
        if (request.contenido() != null) {
            contenido.append(request.contenido());
        }
        if (request.formatoEntrega() != null) {
            contenido.append("\n\nFormato de entrega: ").append(request.formatoEntrega());
        }
        if (request.plazoEntrega() != null) {
            contenido.append("\nPlazo estimado: ").append(request.plazoEntrega()).append(" días hábiles");
        }
        return contenido.toString();
    }
}
