package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.InicioPlazoSubsanacionTtaip;

/** Persistent single origin for the deadline of each requirement. */
public interface InicioPlazoSubsanacionTtaipRepository extends JpaRepository<InicioPlazoSubsanacionTtaip, Long> {}
