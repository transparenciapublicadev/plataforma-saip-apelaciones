package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Apelacion;

import java.util.List;
import java.util.Optional;

@Repository
public interface ApelacionRepository extends JpaRepository<Apelacion, Long> {

    Optional<Apelacion> findByExpediente(String expediente);

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud s LEFT JOIN FETCH s.entidad LEFT JOIN FETCH a.ciudadano WHERE a.expediente = :expediente")
    Optional<Apelacion> findByExpedienteWithDetails(@Param("expediente") String expediente);

    List<Apelacion> findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(Long ciudadanoId);

    List<Apelacion> findByEstadoOrderByFechaApelacionDesc(Apelacion.EstadoApelacion estado);

    List<Apelacion> findByEstadoIn(List<Apelacion.EstadoApelacion> estados);

    long countByEstado(Apelacion.EstadoApelacion estado);

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud LEFT JOIN FETCH a.ciudadano WHERE a.id = :id")
    Optional<Apelacion> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud s LEFT JOIN FETCH s.entidad WHERE a.ciudadano.idUsuario = :ciudadanoId ORDER BY a.fechaApelacion DESC")
    List<Apelacion> findByCiudadanoWithSolicitud(@Param("ciudadanoId") Long ciudadanoId);

    @Query("SELECT a FROM Apelacion a WHERE a.estado NOT IN :estadosFinales ORDER BY a.fechaApelacion DESC")
    List<Apelacion> findPendientes(@Param("estadosFinales") List<Apelacion.EstadoApelacion> estadosFinales);
}

