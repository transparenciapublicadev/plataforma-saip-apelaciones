package pe.gob.saip.backend.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.RespuestaSaipRecepcion;

public interface RespuestaSaipRecepcionRepository extends JpaRepository<RespuestaSaipRecepcion, Long> {
    Optional<RespuestaSaipRecepcion> findBySolicitud_IdSolicitud(Long solicitudId);
    boolean existsByCreadoPor_IdUsuarioAndClaveOperacion(Long actorId, String claveOperacion);
}
