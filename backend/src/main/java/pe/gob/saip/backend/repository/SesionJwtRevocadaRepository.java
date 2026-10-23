package pe.gob.saip.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.gob.saip.backend.model.entity.SesionJwtRevocada;

import java.time.Instant;

/** Atomic insert makes simultaneous logout requests safe without catching aborted transactions. */
public interface SesionJwtRevocadaRepository extends JpaRepository<SesionJwtRevocada, SesionJwtRevocada.Clave> {
    boolean existsByUsuarioIdAndJti(Long usuarioId, String jti);

    @Modifying
    @Query(value = """
            INSERT INTO sesiones_jwt_revocadas (id_usuario, jti, expira_en, revocada_en)
            VALUES (:usuarioId, :jti, :expiraEn, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            """, nativeQuery = true)
    int revocar(@Param("usuarioId") Long usuarioId, @Param("jti") String jti, @Param("expiraEn") Instant expiraEn);
}
