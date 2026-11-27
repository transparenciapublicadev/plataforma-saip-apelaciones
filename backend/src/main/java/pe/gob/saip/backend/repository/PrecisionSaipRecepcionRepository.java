package pe.gob.saip.backend.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import pe.gob.saip.backend.model.entity.PrecisionSaipRecepcion;

/** Access to immutable accepted precision receipts. */
public interface PrecisionSaipRecepcionRepository extends JpaRepository<PrecisionSaipRecepcion, Long> {
    Optional<PrecisionSaipRecepcion> findByObservacion_IdObservacion(Long observacionId);

    Optional<PrecisionSaipRecepcion> findByObservacion_IdObservacionAndClaveOperacion(
            Long observacionId, String claveOperacion);
}
