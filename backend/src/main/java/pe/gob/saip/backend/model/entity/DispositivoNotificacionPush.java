package pe.gob.saip.backend.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
        name = "dispositivos_notificacion_push",
        uniqueConstraints = @UniqueConstraint(name = "uk_dispositivo_push_token_hash", columnNames = "token_hash"),
        indexes = {
            @Index(name = "idx_dispositivo_push_usuario_estado", columnList = "id_usuario, estado"),
            @Index(name = "idx_dispositivo_push_device_hash", columnList = "device_id_hash"),
            @Index(name = "idx_dispositivo_push_flavor", columnList = "app_flavor")
        })
public class DispositivoNotificacionPush {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_dispositivo_push")
    private Long idDispositivoPush;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_usuario", nullable = false, length = 20)
    private Usuario.TipoUsuario tipoUsuario;

    @Enumerated(EnumType.STRING)
    @Column(name = "app_flavor", nullable = false, length = 20)
    private AppFlavor appFlavor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Plataforma plataforma;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "token_cifrado", columnDefinition = "TEXT")
    private String tokenCifrado;

    @Column(name = "device_id_hash", nullable = false, length = 64)
    private String deviceIdHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EstadoDispositivo estado;

    @Column(name = "app_version", length = 40)
    private String appVersion;

    @Column(name = "build_type", length = 20)
    private String buildType;

    @Column(name = "fecha_registro", nullable = false)
    private LocalDateTime fechaRegistro;

    @Column(name = "fecha_actualizacion", nullable = false)
    private LocalDateTime fechaActualizacion;

    @Column(name = "fecha_revocacion")
    private LocalDateTime fechaRevocacion;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @PrePersist
    protected void onCreate() {
        LocalDateTime ahora = LocalDateTime.now();
        fechaRegistro = fechaRegistro != null ? fechaRegistro : ahora;
        fechaActualizacion = ahora;
        estado = estado != null ? estado : EstadoDispositivo.ACTIVO;
    }

    @PreUpdate
    protected void onUpdate() {
        fechaActualizacion = LocalDateTime.now();
    }

    public enum AppFlavor {
        CIUDADANO,
        FUNCIONARIO,
        TTAIP
    }

    public enum Plataforma {
        ANDROID
    }

    public enum EstadoDispositivo {
        ACTIVO,
        REVOCADO,
        EXPIRADO
    }
}
