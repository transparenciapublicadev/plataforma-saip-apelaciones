package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.ExpedienteTtaip;

import java.util.Optional;

@Repository
public interface ExpedienteTtaipRepository extends JpaRepository<ExpedienteTtaip, Long> {

    Optional<ExpedienteTtaip> findByNumeroExpediente(String numeroExpediente);

    Optional<ExpedienteTtaip> findByApelacion_IdApelacion(Long apelacionId);

    long countBySala_Nombre(String nombre);
}
