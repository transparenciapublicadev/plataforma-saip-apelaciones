package pe.gob.saip.backend.model.dto;

import pe.gob.saip.backend.model.entity.Documento;

public record DocumentoUploadRequest(
        Documento.TipoDocumento tipoDocumento,
        Long solicitudId,
        Long respuestaId,
        Long apelacionId,
        Long expedienteTtaipId,
        Long resolucionId,
        Long cedulaNotificacionId) {

    public long relationCount() {
        return relation().relationCount();
    }

    public DocumentoRelacionRequest relation() {
        return new DocumentoRelacionRequest(
                solicitudId,
                respuestaId,
                apelacionId,
                expedienteTtaipId,
                resolucionId,
                cedulaNotificacionId);
    }
}
