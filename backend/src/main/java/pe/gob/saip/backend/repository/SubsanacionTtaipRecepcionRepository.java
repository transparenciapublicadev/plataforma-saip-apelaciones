package pe.gob.saip.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.SubsanacionTtaipRecepcion;

/** Accepted operations are unique per resolution requirement and per operation key. */
public interface SubsanacionTtaipRecepcionRepository extends JpaRepository<SubsanacionTtaipRecepcion, Long> {
    Optional<SubsanacionTtaipRecepcion> findByRequerimiento_IdResolucion(Long requerimientoId);
    Optional<SubsanacionTtaipRecepcion> findByClaveOperacion(String claveOperacion);
}
