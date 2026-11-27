package pe.gob.saip.backend.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Documento;
import pe.gob.saip.backend.storage.StorageProviderType;

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

    List<Documento> findByCumplimiento_IdCumplimientoAndEstadoOrderByIdDocumentoAsc(
            Long cumplimientoId, Documento.EstadoDocumento estado);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Documento> findFirstByStorageProviderAndStorageKeyOrderByIdDocumentoAsc(
            StorageProviderType provider, String storageKey);

    @Query("""
            select d.idDocumento from Documento d
            where d.storageProvider = :provider and d.storageKey = :storageKey and d.estado = :estado
            """)
    List<Long> idsPorObjetoYEstado(StorageProviderType provider, String storageKey, Documento.EstadoDocumento estado);

    Optional<Documento> findByIdDocumentoAndEstado(
            Long documentoId,
            Documento.EstadoDocumento estado);
}

