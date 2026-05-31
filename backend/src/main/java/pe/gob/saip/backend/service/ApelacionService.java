package pe.gob.saip.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.CrearApelacionExternaRequest;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.repository.ApelacionRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class ApelacionService {

    private final ApelacionRepository apelacionRepository;
    private final CiudadanoService ciudadanoService;
    private final EntidadService entidadService;

    public ApelacionService(ApelacionRepository apelacionRepository,
                            CiudadanoService ciudadanoService,
                            EntidadService entidadService) {
        this.apelacionRepository = apelacionRepository;
        this.ciudadanoService = ciudadanoService;
        this.entidadService = entidadService;
    }

    @Transactional(readOnly = true)
    public List<Apelacion> obtenerTodasLasApelaciones() {
        return apelacionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> obtenerApelacionPorId(Long id) {
        return apelacionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> obtenerApelacionPorExpediente(String expediente) {
        return apelacionRepository.findByExpediente(expediente);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> obtenerApelacionesPorEstado(Apelacion.EstadoApelacion estado) {
        return apelacionRepository.findByEstadoOrderByFechaApelacionDesc(estado);
    }

    @Transactional(readOnly = true)
    public long contarApelacionesPorEstado(Apelacion.EstadoApelacion estado) {
        return apelacionRepository.countByEstado(estado);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> findByCiudadanoId(Long ciudadanoId) {
        return apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(ciudadanoId);
    }

    private static final List<Apelacion.EstadoApelacion> ESTADOS_FINALES = List.of(
            Apelacion.EstadoApelacion.RESUELTO,
            Apelacion.EstadoApelacion.RESUELTO_FUNDADO,
            Apelacion.EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE,
            Apelacion.EstadoApelacion.RESUELTO_INFUNDADO,
            Apelacion.EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE,
            Apelacion.EstadoApelacion.RESUELTO_IMPROCEDENTE,
            Apelacion.EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO,
            Apelacion.EstadoApelacion.RESUELTO_NULIDAD_ACTO,
            Apelacion.EstadoApelacion.TENER_POR_NO_PRESENTADO,
            Apelacion.EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA,
            Apelacion.EstadoApelacion.CONCLUSION_DESISTIMIENTO
    );

    @Transactional(readOnly = true)
    public List<Apelacion> findPendientes() {
        return apelacionRepository.findPendientes(ESTADOS_FINALES);
    }

    @Transactional(readOnly = true)
    public List<Apelacion> findAll() {
        return apelacionRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findByExpediente(String expediente) {
        return apelacionRepository.findByExpedienteWithDetails(expediente);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findById(Long id) {
        return apelacionRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public Optional<Apelacion> findByIdWithDetails(Long id) {
        return apelacionRepository.findByIdWithDetails(id);
    }

    /**
     * Genera el siguiente número de expediente TTAIP secuencial.
     * Formato: NNNNN-AAAA-JUS/TTAIP.
     */
    @Transactional
    public String generarExpediente() {
        int year = LocalDate.now().getYear();
        long count = apelacionRepository.count() + 1;
        return String.format("%05d", count) + "-" + year + "-JUS/TTAIP";
    }

    @Transactional
    public Apelacion save(Apelacion apelacion) {
        if (apelacion.getExpediente() == null) {
            apelacion.setExpediente(generarExpediente());
        }
        return apelacionRepository.save(apelacion);
    }

    @Transactional
    public Apelacion crearExterna(CrearApelacionExternaRequest request) {
        validarApelacionExterna(request);

        Ciudadano ciudadano = ciudadanoService.findById(request.ciudadanoId())
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "Ciudadano no encontrado con ID: " + request.ciudadanoId()));
        Entidad entidadApelada = request.entidadId() != null
                ? entidadService.findById(request.entidadId())
                    .orElseThrow(() -> new RecursoNoEncontradoException(
                            "Entidad no encontrada con ID: " + request.entidadId()))
                : null;

        if (entidadApelada == null && esBlanco(request.entidadExternaNombre())) {
            throw new IllegalArgumentException(
                    "Debe registrar una entidad pública del catálogo o el nombre de la entidad externa");
        }
        if (apelacionRepository.existsByTipoOrigenAndNumeroSolicitudExternaIgnoreCaseAndCiudadano_IdUsuario(
                Apelacion.TipoOrigenApelacion.EXTERNA,
                request.numeroSolicitudExterna().trim(),
                request.ciudadanoId())) {
            throw new IllegalArgumentException(
                    "Ya existe una apelación externa para el ciudadano y número de solicitud informado");
        }

        Apelacion apelacion = new Apelacion();
        apelacion.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA);
        apelacion.setCiudadano(ciudadano);
        apelacion.setEntidadApelada(entidadApelada);
        apelacion.setEntidadExternaNombre(normalizarNullable(request.entidadExternaNombre()));
        apelacion.setEntidadExternaRuc(normalizarNullable(request.entidadExternaRuc()));
        apelacion.setEntidadExternaEmail(normalizarNullable(request.entidadExternaEmail()));
        apelacion.setNumeroSolicitudExterna(request.numeroSolicitudExterna().trim());
        apelacion.setFechaPresentacionSolicitudExterna(request.fechaPresentacionSolicitudExterna());
        apelacion.setFechaRespuestaEntidad(request.fechaRespuestaEntidad());
        apelacion.setTipoDenegatoria(request.tipoDenegatoria());
        apelacion.setResumenSolicitudOriginal(request.resumenSolicitudOriginal().trim());
        apelacion.setResumenRespuestaEntidad(normalizarNullable(request.resumenRespuestaEntidad()));
        apelacion.setReferenciaDocumentoSolicitud(request.referenciaDocumentoSolicitud().trim());
        apelacion.setReferenciaCargoRecepcion(normalizarNullable(request.referenciaCargoRecepcion()));
        apelacion.setReferenciaRespuestaEntidad(normalizarNullable(request.referenciaRespuestaEntidad()));
        apelacion.setEvidenciaSilencioAdministrativo(normalizarNullable(request.evidenciaSilencioAdministrativo()));
        apelacion.setFundamentos(request.fundamentos().trim());
        apelacion.setObservacion(normalizarNullable(request.observacion()));
        apelacion.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
        return save(apelacion);
    }

    @Transactional
    public Apelacion guardar(Apelacion apelacion) {
        return save(apelacion);
    }

    @Transactional
    public void guardarApelacion(Apelacion apelacion) {
        save(apelacion);
    }

    @Transactional
    public void eliminarApelacion(Long id) {
        apelacionRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public long count() {
        return apelacionRepository.count();
    }

    @Transactional(readOnly = true)
    public long countByCiudadanoId(Long ciudadanoId) {
        return apelacionRepository.findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(ciudadanoId).size();
    }

    private void validarApelacionExterna(CrearApelacionExternaRequest request) {
        if (request.tipoDenegatoria() == Apelacion.TipoDenegatoria.EXPRESA) {
            if (request.fechaRespuestaEntidad() == null) {
                throw new IllegalArgumentException(
                        "La fecha de respuesta de la entidad es obligatoria para una denegatoria expresa");
            }
            if (esBlanco(request.resumenRespuestaEntidad()) && esBlanco(request.referenciaRespuestaEntidad())) {
                throw new IllegalArgumentException(
                        "Para una denegatoria expresa debe registrar el resumen o referencia de respuesta de la entidad");
            }
        } else if (esBlanco(request.evidenciaSilencioAdministrativo())) {
            throw new IllegalArgumentException(
                    "Para una denegatoria tácita debe registrar sustento del silencio administrativo negativo");
        }

        if (request.fechaRespuestaEntidad() != null
                && request.fechaRespuestaEntidad().isBefore(request.fechaPresentacionSolicitudExterna())) {
            throw new IllegalArgumentException(
                    "La fecha de respuesta de la entidad no puede ser anterior a la solicitud externa");
        }
    }

    private boolean esBlanco(String value) {
        return value == null || value.isBlank();
    }

    private String normalizarNullable(String value) {
        return esBlanco(value) ? null : value.trim();
    }
}

