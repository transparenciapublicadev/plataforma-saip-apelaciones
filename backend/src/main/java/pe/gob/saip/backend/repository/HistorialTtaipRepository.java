package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.HistorialTtaip;

import java.util.List;

@Repository
public interface HistorialTtaipRepository extends JpaRepository<HistorialTtaip, Long> {

    List<HistorialTtaip> findByExpediente_IdExpedienteTtaipOrderByFechaEventoAsc(Long expedienteId);

    boolean existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferencia(
            Long expedienteId,
            HistorialTtaip.TipoEvento tipoEvento,
            String referencia
    );

    boolean existsByExpediente_IdExpedienteTtaipAndTipoEventoAndReferenciaAndEstadoAnteriorAndEstadoNuevo(
            Long expedienteId,
            HistorialTtaip.TipoEvento tipoEvento,
            String referencia,
            String estadoAnterior,
            String estadoNuevo
    );
}
