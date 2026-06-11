package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Documento;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentoRepository extends JpaRepository<Documento, Long> {

    List<Documento> findBySolicitud_IdSolicitud(Long solicitudId);

    List<Documento> findByRespuesta_Id(Long respuestaId);

    Optional<Documento> findByIdDocumentoAndEstado(
            Long documentoId,
            Documento.EstadoDocumento estado);
}

