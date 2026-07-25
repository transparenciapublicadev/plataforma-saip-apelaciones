package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Ciudadano;

import java.util.Optional;

@Repository
public interface CiudadanoRepository extends JpaRepository<Ciudadano, Long> {
    Optional<Ciudadano> findByDni(String dni);

    Optional<Ciudadano> findByRuc(String ruc);

    boolean existsByRuc(String ruc);

    @Query("select c from Ciudadano c where lower(c.email) = lower(:email)")
    Optional<Ciudadano> findByEmail(@Param("email") String email);
}

