package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.DocumentoPreparadoTtaip;
import pe.gob.saip.backend.model.entity.Resolucion;

import java.util.List;

public interface DocumentoPreparadoTtaipRepository extends JpaRepository<DocumentoPreparadoTtaip, Long> {
    List<DocumentoPreparadoTtaip> findByExpediente_IdExpedienteTtaipAndEtapaAndResolucionIsNullOrderById(
            Long expedienteId, Resolucion.TipoResolucion etapa);

    List<DocumentoPreparadoTtaip> findByClaveAndNumeroContaining(String clave, String fragmento);

    List<DocumentoPreparadoTtaip> findByClaveInAndNumeroEndingWith(List<String> claves, String sufijo);
}
