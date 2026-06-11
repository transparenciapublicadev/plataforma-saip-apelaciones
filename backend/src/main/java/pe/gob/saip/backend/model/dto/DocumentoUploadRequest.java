package pe.gob.saip.backend.model.dto;

import pe.gob.saip.backend.model.entity.Documento;

public record DocumentoUploadRequest(
        Documento.TipoDocumento tipoDocumento,
        Long solicitudId,
        Long apelacionId,
        Long expedienteTtaipId,
        Long resolucionId,
        Long cedulaNotificacionId) {

    public long relationCount() {
        return java.util.stream.Stream.of(
                        solicitudId,
                        apelacionId,
                        expedienteTtaipId,
                        resolucionId,
                        cedulaNotificacionId)
                .filter(java.util.Objects::nonNull)
                .count();
    }
}
