package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.SalaTtaip;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalaTtaipRepository extends JpaRepository<SalaTtaip, Long> {

    Optional<SalaTtaip> findByNombre(String nombre);

    List<SalaTtaip> findByActivaTrueOrderByNombreAsc();
}
