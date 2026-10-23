package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AccessLevel;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;
import java.util.Locale;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "usuarios")
@Inheritance(strategy = InheritanceType.JOINED)
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_usuario")
    private Long idUsuario;

    @NotBlank(message = "El email no puede estar vacío")
    @Email(message = "Debe ser un email válido")
    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @NotBlank(message = "La contraseña no puede estar vacía")
    @Column(nullable = false, length = 255)
    private String password;

    @NotNull(message = "El tipo de usuario no puede ser nulo")
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_usuario", nullable = false, length = 20)
    private TipoUsuario tipoUsuario;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    // State changes must use the atomic repository operation, never a stale entity merge.
    @Column(nullable = false, updatable = false)
    private Boolean activo;

    /** Server-owned authentication generation; profile/admin payloads cannot write it. */
    @JsonIgnore
    @Schema(hidden = true)
    @Setter(AccessLevel.NONE)
    @ColumnDefault("0")
    @Column(name = "version_autenticacion", nullable = false, insertable = false, updatable = false)
    private Long versionAutenticacion = 0L;

    @PrePersist
    protected void onCreate() {
        normalizeEmail();
        fechaRegistro = LocalDateTime.now();
        if (activo == null) {
            activo = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        normalizeEmail();
    }

    private void normalizeEmail() {
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }

    public enum TipoUsuario {
        CIUDADANO,
        FUNCIONARIO,
        TTAIP,
        ADMINISTRADOR
    }
}

