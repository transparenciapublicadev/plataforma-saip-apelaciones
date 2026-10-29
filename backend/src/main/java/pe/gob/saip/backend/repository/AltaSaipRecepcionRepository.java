package pe.gob.saip.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.AltaSaipRecepcion;

public interface AltaSaipRecepcionRepository extends JpaRepository<AltaSaipRecepcion,Long> {
    Optional<AltaSaipRecepcion> findByClaveOperacion(String claveOperacion);
}
