package pe.gob.saip.backend.service;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.DocumentoMetadataDTO;
import pe.gob.saip.backend.model.dto.PresentarDescargoEntidadRequest;
import pe.gob.saip.backend.model.dto.RegistrarSuspensionTtaipRequest;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.model.entity.CedulaNotificacion.DestinatarioNotificacion;
import pe.gob.saip.backend.model.entity.PresentacionAdmisionTtaip.Adjunto;
import pe.gob.saip.backend.model.entity.PresentacionAdmisionTtaip.Tipo;
import pe.gob.saip.backend.repository.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA;

@Service
@RequiredArgsConstructor
public class PresentacionesAdmisionTtaipService {
    private final ExpedienteTtaipService expedientes;
    private final PresentacionAdmisionTtaipRepository presentaciones;
    private final NotificacionTtaipRepository notificaciones;
    private final DocumentoRepository archivos;
    private final HistorialTtaipRepository historial;
    private final DocumentoService documentos;
    private final AutorizacionRecursosService autorizacion;
    private final TransicionesApelacionTtaipService transiciones;

    @Schema(name = "ConsultaPresentacionesAdmisionTtaip")
    public record Consulta(boolean puedePresentarSolicitudes, boolean puedeResponderInformeOral, LocalDate fechaLimiteResolucion,
                           Descargo descargo, List<Presentacion> presentaciones) {}
    @Schema(name = "DescargoEnAdmisionTtaip")
    public record Descargo(Long id, String estado, LocalDate fechaLimite, LocalDate fechaPresentacion,
                           String resumen, String referencia, boolean puedePresentar) {}
    @Schema(name = "PresentacionAdmisionTtaip")
    public record Presentacion(Long id, UUID operacion, Tipo tipo, DestinatarioNotificacion origen,
                               String texto, String numeroOficio, LocalDateTime fechaPresentacion,
                               Boolean aceptada, LocalDateTime fechaRespuesta, UUID operacionRespuesta,
                               List<DocumentoMetadataDTO> documentos, DocumentoMetadataDTO respuesta) {}

    @Transactional(readOnly = true)
    public Consulta consultar(Long expedienteId) {
        var expediente = expedientes.buscarExpediente(expedienteId);
        autorizacion.verificarApelacionAccesible(expediente.getApelacion());
        boolean tribunal = autorizacion.esAdministradorOTtaip();
        var parte = parte();
        var admision = ExpedienteTtaipService.resolucionAdmision(expediente);
        boolean notificada = notificada(expediente, admision, parte);
        boolean abierta = ExpedienteTtaipService.admisionAbierta(expediente);
        Descargo descargo = null;
        if (admision != null && (tribunal || (parte == DestinatarioNotificacion.ENTIDAD_PUBLICA && notificada))) {
            var entidad = expediente.getApelacion().getEntidadApeladaEfectiva();
            if (entidad != null) {
                var requerimiento = expedientes.requerimientoDeAdmision(expediente, admision, entidad);
                if (requerimiento != null) descargo = descargo(requerimiento, abierta, tribunal);
            }
        }
        var registros = presentaciones.findByExpediente_IdExpedienteTtaipOrderByIdDesc(expedienteId).stream()
                .filter(p -> tribunal || p.visiblePara(parte, true))
                .map(p -> dto(p, tribunal || p.visiblePara(parte, false), tribunal)).toList();
        return new Consulta(!tribunal && abierta && notificada, tribunal && abierta,
                tribunal || notificada ? expedientes.fechaLimiteResolucionConsultada(expediente) : null, descargo, registros);
    }

    @Transactional
    public Presentacion presentar(Long expedienteId, UUID operacion, Tipo tipo, Long descargoId, String texto,
                                  String numeroOficio, MultipartFile archivo, List<MultipartFile> anexos) {
        if (autorizacion.esAdministradorOTtaip()) {
            throw new AccessDeniedException("Solo el administrado o la entidad pueden presentar escritos");
        }
        transiciones.bloquearExpedienteAccesible(expedienteId);
        var expediente = expedientes.buscarExpediente(expedienteId);
        var usuario = autorizacion.obtenerUsuarioActual();
        var previo = presentaciones.findByExpediente_IdExpedienteTtaipAndOperacion(expedienteId, operacion);
        if (previo.isPresent()) {
            var registrado = previo.get();
            if (!usuario.getIdUsuario().equals(registrado.getUsuario().getIdUsuario()) || registrado.getTipo() != tipo) {
                throw new ConflictoEstadoException("La operación ya corresponde a otra presentación");
            }
            return dto(registrado, true, false);
        }

        var parte = parte();
        var admision = ExpedienteTtaipService.resolucionAdmision(expediente);
        if (!ExpedienteTtaipService.admisionAbierta(expediente) || !notificada(expediente, admision, parte)) {
            throw new ConflictoEstadoException("La presentación requiere una admisión notificada y un expediente abierto");
        }
        boolean entidad = parte == DestinatarioNotificacion.ENTIDAD_PUBLICA;
        if (tipo == Tipo.DESCARGOS && !entidad) {
            throw new AccessDeniedException("Solo la entidad requerida puede presentar descargos");
        }
        if (tipo != Tipo.DESCARGOS && (descargoId != null || anexos != null && !anexos.isEmpty())) {
            throw new IllegalArgumentException("Los anexos se adjuntan al oficio de descargos");
        }

        var presentacion = new PresentacionAdmisionTtaip();
        presentacion.setExpediente(expediente);
        presentacion.setUsuario(usuario);
        presentacion.setOperacion(operacion);
        presentacion.setTipo(tipo);
        presentacion.setOrigen(parte);
        presentacion.setFechaPresentacion(LocalDateTime.now(ZONA_LIMA));
        if (tipo == Tipo.DESCARGOS || (entidad && tipo == Tipo.DOCUMENTACION_ADICIONAL)) {
            presentacion.setNumeroOficio(requerido(numeroOficio, 120, "Ingrese el número de oficio"));
        }
        if (tipo == Tipo.DESCARGOS) {
            var requerimiento = expedientes.requerimientoDeAdmision(expediente, admision,
                    expediente.getApelacion().getEntidadApeladaEfectiva());
            if (requerimiento == null || !requerimiento.getId().equals(descargoId)
                    || !descargo(requerimiento, true, false).puedePresentar()) {
                throw new ConflictoEstadoException("El requerimiento no está disponible para recibir descargos");
            }
            presentacion.setDescargo(requerimiento);
        }
        if (tipo == Tipo.INFORME_ORAL || (entidad && tipo == Tipo.DOCUMENTACION_ADICIONAL)) {
            presentacion.setTexto(requerido(texto, 2000, "Describa su solicitud"));
        }
        if (tipo != Tipo.INFORME_ORAL) requerido(archivo);
        presentaciones.save(presentacion);
        if (archivo != null) guardar(presentacion, archivo, Adjunto.PRINCIPAL);
        if (anexos != null) {
            for (var anexo : anexos) guardar(presentacion, anexo, Adjunto.ANEXO);
        }

        String actor = String.valueOf(usuario.getIdUsuario());
        var fecha = presentacion.getFechaPresentacion().toLocalDate();
        if (tipo == Tipo.DESCARGOS) {
            expedientes.presentarDescargo(expedienteId, descargoId, new PresentarDescargoEntidadRequest(
                    fecha, "Oficio de descargos recibido", null, actor, null));
        } else if (tipo == Tipo.INFORME_ORAL) {
            expedientes.suspenderPorSolicitudDeInformeOral(expediente, new RegistrarSuspensionTtaipRequest(
                    fecha, parte.name(), "Solicitud de informe oral recibida", actor, null));
        }
        registrar(presentacion, switch (tipo) {
            case DESCARGOS -> "Oficio de descargos y anexos recibidos";
            case INFORME_ORAL -> "Solicitud de informe oral recibida";
            case DOCUMENTACION_ADICIONAL -> "Documentación adicional recibida";
        }, usuario);
        return dto(presentacion, true, false);
    }

    @Transactional
    public Presentacion responder(Long expedienteId, Long id, UUID operacion, boolean aceptada, MultipartFile archivo) {
        autorizacion.verificarTtaipOAdministrador();
        transiciones.bloquearExpedienteAccesible(expedienteId);
        var presentacion = presentaciones.findByIdAndExpediente_IdExpedienteTtaip(id, expedienteId)
                .filter(p -> p.getTipo() == Tipo.INFORME_ORAL)
                .orElseThrow(() -> new RecursoNoEncontradoException("Solicitud de informe oral no encontrada"));
        if (operacion.equals(presentacion.getOperacionRespuesta())) return dto(presentacion, true, true);
        if (presentacion.getFechaRespuesta() != null || !ExpedienteTtaipService.admisionAbierta(presentacion.getExpediente())) {
            throw new ConflictoEstadoException("El informe oral ya fue respondido o el expediente ha concluido");
        }
        requerido(archivo);
        var usuario = autorizacion.obtenerUsuarioActual();
        guardar(presentacion, archivo, Adjunto.RESPUESTA);
        presentacion.setAceptada(aceptada);
        presentacion.setFechaRespuesta(LocalDateTime.now(ZONA_LIMA));
        presentacion.setOperacionRespuesta(operacion);
        presentacion.setUsuarioRespuesta(usuario);
        registrar(presentacion, aceptada ? "Informe oral programado" : "Informe oral denegado", usuario);
        return dto(presentacion, true, true);
    }

    private boolean notificada(ExpedienteTtaip expediente, Resolucion admision, DestinatarioNotificacion parte) {
        return admision != null && notificaciones
                .findByCedula_Resolucion_IdResolucionAndDestinatarioOrderByFechaNotificacionDesc(admision.getId(), parte)
                .stream().anyMatch(n -> expediente.getId().equals(n.getExpediente().getId())
                        && n.getCedula().getDestinatario() == parte && transiciones.evidenciaEficaz(n));
    }

    private DestinatarioNotificacion parte() {
        return autorizacion.esFuncionario() ? DestinatarioNotificacion.ENTIDAD_PUBLICA : DestinatarioNotificacion.CIUDADANO;
    }

    private static Descargo descargo(DescargoEntidadTtaip requerimiento, boolean abierta, boolean tribunal) {
        boolean pendiente = requerimiento.getEstadoDescargo() == DescargoEntidadTtaip.EstadoDescargo.REQUERIDO;
        boolean vencido = pendiente && LocalDate.now(ZONA_LIMA).isAfter(requerimiento.getFechaLimiteDescargo());
        String estado = pendiente && !abierta ? "CERRADO_SIN_PRESENTACION"
                : vencido ? "VENCIDO_SIN_PRESENTACION" : requerimiento.getEstadoDescargo().name();
        return new Descargo(requerimiento.getId(), estado,
                requerimiento.getFechaLimiteDescargo(), requerimiento.getFechaPresentacion(),
                requerimiento.getResumenDescargo(), requerimiento.getDocumentoDescargo(), !tribunal && abierta && pendiente && !vencido);
    }

    private void guardar(PresentacionAdmisionTtaip presentacion, MultipartFile archivo, Adjunto clase) {
        Documento documento = new Documento();
        documento.setTipoDocumento(Documento.TipoDocumento.DOCUMENTO_ADJUNTO);
        documento.setExpedienteTtaip(presentacion.getExpediente());
        documento.setPresentacionAdmision(presentacion);
        documento.setClaseAdjuntoAdmision(clase);
        documentos.subirActoTtaip(archivo, documento, null);
    }

    private Presentacion dto(PresentacionAdmisionTtaip p, boolean verEscrito, boolean tribunal) {
        var todos = archivos.findByPresentacionAdmision_IdAndEstadoOrderByIdDocumentoAsc(p.getId(), Documento.EstadoDocumento.ACTIVO);
        var adjuntos = verEscrito ? todos.stream().filter(d -> d.getClaseAdjuntoAdmision() != Adjunto.RESPUESTA)
                .map(DocumentoMetadataDTO::from).toList() : List.<DocumentoMetadataDTO>of();
        var respuesta = todos.stream().filter(d -> d.getClaseAdjuntoAdmision() == Adjunto.RESPUESTA)
                .findFirst().map(DocumentoMetadataDTO::from).orElse(null);
        return new Presentacion(p.getId(), verEscrito ? p.getOperacion() : null, p.getTipo(), p.getOrigen(),
                verEscrito ? p.getTexto() : null, verEscrito ? p.getNumeroOficio() : null,
                verEscrito ? p.getFechaPresentacion() : null, p.getAceptada(), p.getFechaRespuesta(),
                tribunal ? p.getOperacionRespuesta() : null, adjuntos, respuesta);
    }

    private void registrar(PresentacionAdmisionTtaip p, String descripcion, Usuario usuario) {
        var evento = new HistorialTtaip();
        evento.setExpediente(p.getExpediente());
        evento.setTipoEvento(HistorialTtaip.TipoEvento.AUDITORIA);
        evento.setDescripcion(descripcion);
        evento.setActor(String.valueOf(usuario.getIdUsuario()));
        evento.setReferencia("PRESENTACION-ADMISION-" + p.getId());
        historial.save(evento);
    }

    private static String requerido(String valor, int max, String mensaje) {
        if (valor == null || valor.isBlank() || valor.strip().length() > max) throw new IllegalArgumentException(mensaje);
        return valor.strip();
    }

    private static void requerido(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) throw new IllegalArgumentException("Adjunte el documento principal");
    }
}
