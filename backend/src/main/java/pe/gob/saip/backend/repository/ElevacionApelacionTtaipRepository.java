package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.ElevacionApelacionTtaip;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ElevacionApelacionTtaipRepository extends JpaRepository<ElevacionApelacionTtaip, Long> {

    Optional<ElevacionApelacionTtaip> findByApelacion_IdApelacion(Long apelacionId);

    List<ElevacionApelacionTtaip> findByEntidadOrigen_IdEntidadAndEstadoElevacionOrderByFechaLimiteElevacionAsc(
            Long entidadId,
            ElevacionApelacionTtaip.EstadoElevacion estadoElevacion
    );

    List<ElevacionApelacionTtaip> findByEstadoElevacionAndFechaLimiteElevacionBefore(
            ElevacionApelacionTtaip.EstadoElevacion estadoElevacion,
            LocalDate fecha
    );
}
