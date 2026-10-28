package pe.gob.saip.backend.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.gob.saip.backend.exception.ConflictoEstadoException;
import pe.gob.saip.backend.exception.RecursoNoEncontradoException;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.storage.StorageException;

/** Reads committed receipts without creating aggregates, rebuilding history or changing clocks. */
@Service
public class ConsultaRecepcionSubsanacionTtaipService {
    private final ExpedienteTtaipRepository expedientes;
    private final ResolucionRepository resoluciones;
    private final SubsanacionTtaipRecepcionRepository recepciones;
    private final AutorizacionRecursosService autorizacion;
    private final DocumentoService documentos;

    public ConsultaRecepcionSubsanacionTtaipService(ExpedienteTtaipRepository expedientes,
            ResolucionRepository resoluciones, SubsanacionTtaipRecepcionRepository recepciones,
            AutorizacionRecursosService autorizacion, DocumentoService documentos) {
        this.expedientes=expedientes; this.resoluciones=resoluciones; this.recepciones=recepciones;
        this.autorizacion=autorizacion; this.documentos=documentos;
    }

    @Transactional(readOnly=true)
    public ConsultaRecepcionSubsanacionTtaipDTO consultar(Long expedienteId, Long requerimientoId) {
        autorizacion.verificarTtaipOAdministrador();
        autorizacion.verificarExpedienteTtaipAccesible(expedienteId);
        ExpedienteTtaip exp=expedientes.findById(expedienteId)
            .orElseThrow(() -> new RecursoNoEncontradoException("Expediente TTAIP no encontrado"));
        Apelacion ap=exp.getApelacion();
        if (ap==null || ap.getExpedienteTtaip()==null || !expedienteId.equals(ap.getExpedienteTtaip().getId())
                || !exp.getNumeroExpediente().equals(ap.getExpediente()))
            throw new ConflictoEstadoException("Las relaciones del expediente están incompletas o son incompatibles");
        Resolucion req=resoluciones.findById(requerimientoId)
            .orElseThrow(() -> new RecursoNoEncontradoException("Requerimiento no encontrado"));
        if (!ap.getId().equals(req.getApelacion().getId()) || req.getExpedienteTtaip()==null
                || !expedienteId.equals(req.getExpedienteTtaip().getId()))
            throw new RecursoNoEncontradoException("El requerimiento no pertenece al expediente indicado");
        if (req.getTipoResolucion()!=Resolucion.TipoResolucion.PRIMERA_CALIFICACION
                || req.getDecision()!=Resolucion.DecisionResolucion.INADMISIBLE)
            throw new ConflictoEstadoException("La actuación no es un requerimiento de subsanación");
        var encontrada=recepciones.findByRequerimiento_IdResolucion(requerimientoId);
        if (encontrada.isEmpty()) return new ConsultaRecepcionSubsanacionTtaipDTO(expedienteId, ap.getId(),
            requerimientoId, ap.getExpediente(), "AUSENTE", null, null, null, List.of());
        SubsanacionTtaipRecepcion receipt=encontrada.get();
        List<DocumentoMetadataDTO> metadata=receipt.getDocumentos().stream().map(doc -> {
            if (doc.getApelacion()==null || !ap.getId().equals(doc.getApelacion().getId())
                    || doc.getTipoDocumento()!=Documento.TipoDocumento.SUBSANACION
                    || doc.getSolicitud()!=null || doc.getRespuesta()!=null || doc.getResolucion()!=null
                    || doc.getExpedienteTtaip()!=null || doc.getCedulaNotificacion()!=null)
                throw new ConflictoEstadoException("Un documento de la recepción no corresponde al recurso");
            try { return documentos.obtenerMetadataDisponible(doc.getId()); }
            catch (RecursoNoEncontradoException e) {
                throw new StorageException(StorageException.Reason.IO_ERROR,
                    "La recepción existe pero no se pudo recuperar uno de sus archivos", e);
            }
        }).toList();
        return new ConsultaRecepcionSubsanacionTtaipDTO(expedienteId, ap.getId(), requerimientoId,
            ap.getExpediente(), "RECIBIDA", receipt.getId(), receipt.getFechaRecepcion(), receipt.getFundamentos(), metadata);
    }
}
