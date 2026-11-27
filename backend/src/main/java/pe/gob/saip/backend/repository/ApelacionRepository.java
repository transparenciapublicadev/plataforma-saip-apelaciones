package pe.gob.saip.backend.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Apelacion;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ApelacionRepository extends JpaRepository<Apelacion, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Apelacion a where a.idApelacion = :id")
    Optional<Apelacion> findByIdForUpdate(@Param("id") Long id);

    Optional<Apelacion> findByExpediente(String expediente);

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud s LEFT JOIN FETCH s.entidad LEFT JOIN FETCH a.entidadApelada LEFT JOIN FETCH a.ciudadano WHERE a.expediente = :expediente")
    Optional<Apelacion> findByExpedienteWithDetails(@Param("expediente") String expediente);

    List<Apelacion> findByCiudadano_IdUsuarioOrderByFechaApelacionDesc(Long ciudadanoId);

    Page<Apelacion> findByCiudadano_IdUsuario(Long ciudadanoId, Pageable pageable);

    List<Apelacion> findByEstadoOrderByFechaApelacionDesc(Apelacion.EstadoApelacion estado);

    Page<Apelacion> findByEstado(Apelacion.EstadoApelacion estado, Pageable pageable);

    List<Apelacion> findByEstadoIn(List<Apelacion.EstadoApelacion> estados);

    long countByEstado(Apelacion.EstadoApelacion estado);

    long countByEstadoIn(Collection<Apelacion.EstadoApelacion> estados);

    @Query("SELECT COUNT(DISTINCT a.ciudadano.idUsuario) FROM Apelacion a")
    long countDistinctCiudadanos();

    @Query("SELECT MONTH(a.fechaApelacion), COUNT(a) FROM Apelacion a WHERE YEAR(a.fechaApelacion) = :year GROUP BY MONTH(a.fechaApelacion)")
    List<Object[]> countByMonth(@Param("year") int year);

    @Query("""
            SELECT COALESCE(COALESCE(se.acronimo, ea.acronimo), COALESCE(se.nombre, COALESCE(ea.nombre, a.entidadExternaNombre))), COUNT(a)
            FROM Apelacion a
            LEFT JOIN a.solicitud s
            LEFT JOIN s.entidad se
            LEFT JOIN a.entidadApelada ea
            WHERE se IS NOT NULL OR ea IS NOT NULL OR a.entidadExternaNombre IS NOT NULL
            GROUP BY se.idEntidad, se.acronimo, se.nombre, ea.idEntidad, ea.acronimo, ea.nombre, a.entidadExternaNombre
            ORDER BY COUNT(a) DESC
            """)
    List<Object[]> countByEntidad();

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud LEFT JOIN FETCH a.entidadApelada LEFT JOIN FETCH a.ciudadano WHERE a.id = :id")
    Optional<Apelacion> findByIdWithDetails(@Param("id") Long id);

    @Query("SELECT a FROM Apelacion a LEFT JOIN FETCH a.solicitud s LEFT JOIN FETCH s.entidad LEFT JOIN FETCH a.entidadApelada WHERE a.ciudadano.idUsuario = :ciudadanoId ORDER BY a.fechaApelacion DESC")
    List<Apelacion> findByCiudadanoWithSolicitud(@Param("ciudadanoId") Long ciudadanoId);

    @Query("SELECT a FROM Apelacion a WHERE a.estado NOT IN :estadosFinales ORDER BY a.fechaApelacion DESC")
    List<Apelacion> findPendientes(@Param("estadosFinales") List<Apelacion.EstadoApelacion> estadosFinales);

    boolean existsByTipoOrigenAndNumeroSolicitudExternaIgnoreCaseAndCiudadano_IdUsuario(
            Apelacion.TipoOrigenApelacion tipoOrigen,
            String numeroSolicitudExterna,
            Long ciudadanoId);
}

