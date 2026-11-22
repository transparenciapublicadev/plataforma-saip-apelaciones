package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Documento;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {

    List<Documento> findBySolicitud_IdSolicitudAndEstadoOrderByFechaCreacionDesc(
            Long solicitudId,
            Documento.EstadoDocumento estado);

    List<Documento> findByRespuesta_IdRespuestaAndEstadoOrderByFechaCreacionDesc(
            Long respuestaId,
            Documento.EstadoDocumento estado);

    List<Documento> findByApelacion_IdApelacionAndEstadoOrderByFechaCreacionDesc(
            Long apelacionId,
            Documento.EstadoDocumento estado);

    List<Documento> findByExpedienteTtaip_IdExpedienteTtaipAndEstadoOrderByFechaCreacionDesc(
            Long expedienteTtaipId,
            Documento.EstadoDocumento estado);

    List<Documento> findByResolucion_IdResolucionAndEstadoOrderByFechaCreacionDesc(
            Long resolucionId,
            Documento.EstadoDocumento estado);

    List<Documento> findByCedulaNotificacion_IdCedulaAndEstadoOrderByFechaCreacionDesc(
            Long cedulaId,
            Documento.EstadoDocumento estado);

    List<Documento> findByPresentacionAdmision_IdAndEstadoOrderByIdDocumentoAsc(
            Long presentacionId, Documento.EstadoDocumento estado);

    Optional<Documento> findByIdDocumentoAndEstado(
            Long documentoId,
            Documento.EstadoDocumento estado);
}

