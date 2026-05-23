package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.NotificacionTtaip;

@Repository
public interface NotificacionTtaipRepository extends JpaRepository<NotificacionTtaip, Long> {

    boolean existsByCedula_IdCedula(Long cedulaId);
}
