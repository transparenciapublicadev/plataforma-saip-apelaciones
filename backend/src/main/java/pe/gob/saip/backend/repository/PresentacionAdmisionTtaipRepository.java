package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.gob.saip.backend.model.entity.PresentacionAdmisionTtaip;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PresentacionAdmisionTtaipRepository extends JpaRepository<PresentacionAdmisionTtaip, Long> {
    List<PresentacionAdmisionTtaip> findByExpediente_IdExpedienteTtaipOrderByIdDesc(Long expedienteId);
    Optional<PresentacionAdmisionTtaip> findByExpediente_IdExpedienteTtaipAndOperacion(Long expedienteId, UUID operacion);
    Optional<PresentacionAdmisionTtaip> findByIdAndExpediente_IdExpedienteTtaip(Long id, Long expedienteId);
}
