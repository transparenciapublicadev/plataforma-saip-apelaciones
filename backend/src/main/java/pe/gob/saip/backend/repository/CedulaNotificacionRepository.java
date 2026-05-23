package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.CedulaNotificacion;

@Repository
public interface CedulaNotificacionRepository extends JpaRepository<CedulaNotificacion, Long> {

    boolean existsByResolucion_IdResolucionAndDestinatario(
            Long resolucionId,
            CedulaNotificacion.DestinatarioNotificacion destinatario
    );

    long countByNumeroCedulaStartingWith(String prefix);
}
