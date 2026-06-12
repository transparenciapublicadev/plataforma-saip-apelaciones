package pe.gob.saip.backend.model.dto;

import java.util.Objects;
import java.util.stream.Stream;

public record DocumentoRelacionRequest(
        Long solicitudId,
        Long respuestaId,
        Long apelacionId,
        Long expedienteTtaipId,
        Long resolucionId,
        Long cedulaNotificacionId) {

    public long relationCount() {
        return Stream.of(
                        solicitudId,
                        respuestaId,
                        apelacionId,
                        expedienteTtaipId,
                        resolucionId,
                        cedulaNotificacionId)
                .filter(Objects::nonNull)
                .count();
    }
}
