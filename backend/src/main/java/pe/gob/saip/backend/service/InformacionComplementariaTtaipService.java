package pe.gob.saip.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class InformacionComplementariaTtaipService {
    private static final int PLAZO_RESPUESTA = 3;
    private static final int PLAZO_PRIMERA = 7;

    private final ExpedienteTtaipRepository expedientes;
    private final PlazoCalculadorService calendario;
    private final AltaApelacionRecepcionRepository ingresos;
    private final SuspensionPlazoTtaipRepository suspensiones;
    private final DocumentoRepository archivos;
    private final HistorialTtaipRepository historial;
    private final DocumentoService documentos;
    private final ExpedienteTtaipService expedienteService;
    private final AutorizacionRecursosService autorizacion;
    private final TransicionesApelacionTtaipService transiciones;

    public record Consulta(String etapa, String entidad, boolean puedeSolicitar,
                           LocalDate fechaLimiteCalificacion, int diasSuspendidos, List<Solicitud> solicitudes) {}

    public record Solicitud(Long id, String etapa, String solicitud, LocalDate fechaSolicitud, LocalDate fechaLimite,
                            String estado, String respuesta, LocalDateTime fechaRespuesta,
                            List<DocumentoMetadataDTO> adjuntos, List<DocumentoMetadataDTO> adjuntosRespuesta) {}

    @Transactional(readOnly = true)
    public Consulta consultar(Long expedienteId) {
        autorizacion.verificarExpedienteTtaipInstitucional(expedienteId);
        var expediente = expediente(expedienteId);
        var apelacion = expediente.getApelacion();
        var etapa = etapa(apelacion);
        var registros = listar(expedienteId);
        int dias = registros.stream().filter(s -> etapa != null && s.getEtapaComplementaria() == etapa)
                .mapToInt(SuspensionPlazoTtaip::getDiasSuspendidos).sum();
        LocalDate ingreso = etapa == Resolucion.TipoResolucion.PRIMERA_CALIFICACION ? fechaIngreso(expediente) : null;
        LocalDate limite = ingreso != null ? calendario.calcularFechaVencimiento(ingreso, PLAZO_PRIMERA + dias)
                : etapa == Resolucion.TipoResolucion.RESOLUCION_FINAL ? expedienteService.fechaLimiteResolucionConsultada(expediente) : null;
        return new Consulta(etapa == null ? null : etapa.name(), apelacion.getEntidadNombreEfectivo(),
                etapa != null && apelacion.getEntidadApeladaEfectiva() != null
                        && registros.stream().noneMatch(s -> s.getEtapaComplementaria() == etapa && pendiente(s)),
                limite, dias, registros.stream().map(this::dto).toList());
    }

    @Transactional
    public Consulta solicitar(Long expedienteId, String solicitud, List<MultipartFile> adjuntos) {
        autorizacion.verificarTtaipOAdministrador();
        var expediente = expediente(expedienteId);
        var apelacion = transiciones.bloquear(expediente.getApelacion().getId());
        var etapa = etapa(apelacion);
        if (etapa == null || apelacion.getEntidadApeladaEfectiva() == null) {
            throw new ConflictoEstadoException("El expediente requiere una calificación abierta y una entidad vinculada con acceso al panel");
        }
        var registros = listar(expedienteId);
        if (registros.stream().anyMatch(s -> s.getEtapaComplementaria() == etapa && pendiente(s))) {
            throw new ConflictoEstadoException("La entidad ya tiene un requerimiento activo en esta etapa");
        }
        LocalDate hoy = calendario.hoy();
        var suspension = new SuspensionPlazoTtaip();
        suspension.setExpediente(expediente);
        suspension.setEtapaComplementaria(etapa);
        suspension.setSolicitante(SuspensionPlazoTtaip.SolicitanteSuspension.TTAIP);
        suspension.setMotivoSuspension(SuspensionPlazoTtaip.MotivoSuspension.INFORMACION_COMPLEMENTARIA);
        suspension.setMotivoDetalle(texto(solicitud));
        suspension.setFechaSolicitud(hoy);
        suspension.setFechaInicioSuspension(hoy);
        suspension.setFechaFinSuspension(calendario.calcularFechaVencimiento(hoy, PLAZO_RESPUESTA));
        suspension.setDiasSuspendidos(PLAZO_RESPUESTA);
        suspension.setResponsable(actor());
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.ACTIVA);
        suspensiones.save(suspension);
        anexar(suspension, adjuntos, false);
        if (etapa == Resolucion.TipoResolucion.RESOLUCION_FINAL) expedienteService.recalcularFechaLimiteResolucion(expediente);
        registrar(suspension, "Información complementaria solicitada a " + apelacion.getEntidadNombreEfectivo());
        return consultar(expedienteId);
    }

    @Transactional
    public Consulta responder(Long expedienteId, Long suspensionId, String respuesta, List<MultipartFile> adjuntos) {
        autorizacion.verificarExpedienteTtaipInstitucional(expedienteId);
        transiciones.bloquearExpedienteAccesible(expedienteId);
        var suspension = listar(expedienteId).stream().filter(s -> Objects.equals(s.getId(), suspensionId))
                .findFirst().orElseThrow(() -> new RecursoNoEncontradoException("Requerimiento no encontrado"));
        if (suspension.getFechaRespuestaComplementaria() != null
                || suspension.getEstadoSuspension() == SuspensionPlazoTtaip.EstadoSuspension.CANCELADA) {
            throw new ConflictoEstadoException("La solicitud ya fue atendida o cancelada");
        }
        suspension.setRespuestaComplementaria(texto(respuesta));
        suspension.setFechaRespuestaComplementaria(LocalDateTime.now());
        suspension.setEstadoSuspension(SuspensionPlazoTtaip.EstadoSuspension.CERRADA);
        anexar(suspension, adjuntos, true);
        registrar(suspension, "La entidad presentó información complementaria");
        return consultar(expedienteId);
    }

    static boolean pendiente(SuspensionPlazoTtaip s) {
        return s.getEstadoSuspension() == SuspensionPlazoTtaip.EstadoSuspension.ACTIVA
                && !LocalDate.now().isAfter(s.getFechaFinSuspension());
    }

    private static Resolucion.TipoResolucion etapa(Apelacion ap) {
        return switch (ap.getEstado()) {
            case EN_CALIFICACION_1 -> Resolucion.TipoResolucion.PRIMERA_CALIFICACION;
            case EN_CALIFICACION_2 -> Resolucion.TipoResolucion.SEGUNDA_CALIFICACION;
            case EN_RESOLUCION -> Resolucion.TipoResolucion.RESOLUCION_FINAL;
            case NOTIFICACION_SEGUNDA_CALIFICACION -> TransicionesApelacionTtaipService
                    .admisionDocumentalValidada(ap.getResolucionSegundaCalificacion()) ? Resolucion.TipoResolucion.RESOLUCION_FINAL : null;
            default -> null;
        };
    }

    private void anexar(SuspensionPlazoTtaip suspension, List<MultipartFile> adjuntos, boolean respuesta) {
        if (adjuntos == null) return;
        for (var archivo : adjuntos) {
            Documento doc = new Documento();
            doc.setTipoDocumento(Documento.TipoDocumento.DOCUMENTO_ADJUNTO);
            doc.setExpedienteTtaip(suspension.getExpediente());
            doc.setSoloInstitucionalTtaip(true);
            var guardado = documentos.subirActoTtaip(archivo, doc, null);
            suspension.getDocumentosComplementarios().put(guardado.getId(), respuesta);
        }
    }

    private Solicitud dto(SuspensionPlazoTtaip s) {
        var docs = archivos.findAllById(s.getDocumentosComplementarios().keySet()).stream()
                .filter(d -> d.getEstado() == Documento.EstadoDocumento.ACTIVO).toList();
        String estado = s.getFechaRespuestaComplementaria() != null ? "RESPONDIDA"
                : s.getEstadoSuspension() == SuspensionPlazoTtaip.EstadoSuspension.CANCELADA ? "CANCELADA"
                : pendiente(s) ? "PENDIENTE" : "VENCIDA";
        return new Solicitud(s.getId(), s.getEtapaComplementaria().name(), s.getMotivoDetalle(), s.getFechaSolicitud(),
                s.getFechaFinSuspension(), estado, s.getRespuestaComplementaria(), s.getFechaRespuestaComplementaria(),
                docs.stream().filter(d -> !s.getDocumentosComplementarios().get(d.getId())).map(DocumentoMetadataDTO::from).toList(),
                docs.stream().filter(d -> s.getDocumentosComplementarios().get(d.getId())).map(DocumentoMetadataDTO::from).toList());
    }

    private void registrar(SuspensionPlazoTtaip s, String descripcion) {
        HistorialTtaip evento = new HistorialTtaip();
        evento.setExpediente(s.getExpediente());
        evento.setTipoEvento(HistorialTtaip.TipoEvento.SUSPENSION_PLAZO);
        evento.setDescripcion(descripcion);
        evento.setActor(actor());
        evento.setReferencia("INFORMACION-COMPLEMENTARIA-" + s.getId());
        historial.save(evento);
    }

    private LocalDate fechaIngreso(ExpedienteTtaip expediente) {
        var apelacion = expediente.getApelacion();
        var elevacion = apelacion.getElevacion();
        if (elevacion != null) {
            return switch (elevacion.getEstadoElevacion()) {
                case ELEVADA -> elevacion.getFechaElevacionTtaip() == null ? null : elevacion.getFechaElevacionTtaip().toLocalDate();
                case ADMITIDA_EXCEPCIONALMENTE -> expediente.getFechaApertura().toLocalDate();
                default -> null;
            };
        }
        return ingresos.findFirstByApelacion_IdApelacionAndCreadoPor_IdUsuario(apelacion.getId(), apelacion.getCiudadano().getId())
                .filter(r -> List.of("DIRECTA_TTAIP", "EXTERNA").contains(r.getModalidad()))
                .map(r -> r.getFechaRecepcion().toLocalDate()).orElse(null);
    }

    private String actor() {
        return String.valueOf(autorizacion.obtenerUsuarioActual().getIdUsuario());
    }

    private String texto(String texto) {
        if (texto == null || texto.isBlank() || texto.length() > 5000) {
            throw new IllegalArgumentException("Ingrese un texto de hasta 5000 caracteres");
        }
        return texto.trim();
    }

    private List<SuspensionPlazoTtaip> listar(Long id) {
        return suspensiones.findByExpediente_IdExpedienteTtaipOrderByFechaInicioSuspensionAsc(id).stream()
                .filter(s -> s.getEtapaComplementaria() != null).toList();
    }

    private ExpedienteTtaip expediente(Long id) {
        return expedientes.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("Expediente no encontrado"));
    }
}
