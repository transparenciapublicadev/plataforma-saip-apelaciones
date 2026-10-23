package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import pe.gob.saip.backend.model.entity.Usuario;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    @Query("select u from Usuario u where lower(u.email) = lower(:email)")
    Optional<Usuario> findByEmail(@Param("email") String email);

    /** Locks the user row and changes state/generation together in one database statement. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE usuarios
               SET version_autenticacion = version_autenticacion
                       + CASE WHEN activo = true AND :activo = false THEN 1 ELSE 0 END,
                   activo = :activo
             WHERE id_usuario = :id
            """, nativeQuery = true)
    int actualizarEstadoAutenticacion(@Param("id") Long id, @Param("activo") boolean activo);
}

