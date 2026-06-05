package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Entidad;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntidadRepository extends JpaRepository<Entidad, Long> {

    @Query("select e from Entidad e where lower(e.acronimo) = lower(:acronimo)")
    Optional<Entidad> findByAcronimo(@Param("acronimo") String acronimo);

    Optional<Entidad> findByNombre(String nombre);

    List<Entidad> findByActivaTrue();

    List<Entidad> findByNombreContainingIgnoreCase(String nombre);
}

