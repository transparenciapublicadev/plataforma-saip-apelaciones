package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "intentos_notificacion", indexes = {
    @Index(name = "idx_intento_notificacion_ttaip", columnList = "id_notificacion_ttaip"),
    @Index(name = "idx_intento_notificacion_saip", columnList = "id_solicitud"),
    @Index(name = "idx_intento_notificacion_estado", columnList = "estado"),
    @Index(name = "idx_intento_notificacion_correlacion", columnList = "codigo_correlacion")
})
public class IntentoNotificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_intento")
    private Long idIntento;

    @ManyToOne
    @JoinColumn(name = "id_notificacion_ttaip")
    private NotificacionTtaip notificacionTtaip;

    @ManyToOne
    @JoinColumn(name = "id_solicitud")
    private Solicitud solicitud;

    @NotNull(message = "El origen de la notificación es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrigenNotificacion origen;

    @NotNull(message = "El canal de notificación es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private CanalEnvio canal;

    @NotBlank(message = "El proveedor de notificación es obligatorio")
    @Column(nullable = false, length = 40)
    private String proveedor;

    @NotNull(message = "El estado del intento es obligatorio")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoIntento estado;

    @Column(name = "destinatario_nombre", length = 200)
    private String destinatarioNombre;

    @Column(name = "destinatario_contacto", length = 200)
    private String destinatarioContacto;

    @Column(length = 300)
    private String asunto;

    @Column(name = "codigo_correlacion", nullable = false, length = 80)
    private String codigoCorrelacion;

    @Column(name = "codigo_envio", length = 120)
    private String codigoEnvio;

    @Column(name = "codigo_constancia", length = 120)
    private String codigoConstancia;

    @Column(name = "constancia_envio", columnDefinition = "TEXT")
    private String constanciaEnvio;

    @Column(name = "acuse_automatico", columnDefinition = "TEXT")
    private String acuseAutomatico;

    @Column(name = "estado_acuse", length = 40)
    private String estadoAcuse;

    @Column(name = "mensaje_tecnico_sanitizado", length = 500)
    private String mensajeTecnicoSanitizado;

    @Column(name = "responsable", length = 120)
    private String responsable;

    @Column(name = "fecha_intento", nullable = false)
    private LocalDateTime fechaIntento;

    @Column(name = "fecha_respuesta")
    private LocalDateTime fechaRespuesta;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @PrePersist
    protected void onCreate() {
        if ((notificacionTtaip == null) == (solicitud == null)) {
            throw new IllegalStateException("El intento debe pertenecer a una notificación TTAIP o a una SAIP");
        }
        fechaIntento = fechaIntento != null ? fechaIntento : LocalDateTime.now();
        estado = estado != null ? estado : EstadoIntento.PENDIENTE;
    }

    public Long getId() {
        return idIntento;
    }

    public enum OrigenNotificacion {
        TTAIP,
        SAIP
    }

    public enum CanalEnvio {
        CORREO_ELECTRONICO,
        CASILLA_ELECTRONICA,
        PLATAFORMA,
        FISICA
    }

    public enum EstadoIntento {
        PENDIENTE,
        ENVIADO,
        ENTREGADO,
        FALLIDO,
        NO_DISPONIBLE
    }
}
