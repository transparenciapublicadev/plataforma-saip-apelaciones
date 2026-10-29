package pe.gob.saip.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.AltaApelacionRecepcion;

public interface AltaApelacionRecepcionRepository extends JpaRepository<AltaApelacionRecepcion,Long> {
    Optional<AltaApelacionRecepcion> findByClaveOperacion(String claveOperacion);
}
