package pe.gob.saip.backend.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

/** Persistent revocation of one signed issuance; never stores a JWT or its bytes. */
@Entity
@Table(name = "sesiones_jwt_revocadas")
@IdClass(SesionJwtRevocada.Clave.class)
public class SesionJwtRevocada {
    @Id
    @Column(name = "id_usuario", nullable = false)
    private Long usuarioId;

    @Id
    @Column(nullable = false, length = 36)
    private String jti;

    @Column(name = "expira_en", nullable = false)
    private Instant expiraEn;

    @Column(name = "revocada_en", nullable = false)
    private Instant revocadaEn;

    /** Issuance identity is scoped to the account resolved from the verified subject. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Clave implements Serializable {
        private Long usuarioId;
        private String jti;
    }
}
