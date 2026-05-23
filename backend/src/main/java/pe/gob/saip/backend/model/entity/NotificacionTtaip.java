package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "notificaciones_ttaip", indexes = {
    @Index(name = "idx_notificacion_expediente", columnList = "id_expediente_ttaip"),
    @Index(name = "idx_notificacion_cedula", columnList = "id_cedula", unique = true),
    @Index(name = "idx_notificacion_destinatario", columnList = "destinatario")
})
public class NotificacionTtaip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_notificacion")
    private Long idNotificacion;

    @NotNull(message = "El expediente asociado es obligatorio")
    @ManyToOne
    @JoinColumn(name = "id_expediente_ttaip", nullable = false)
    private ExpedienteTtaip expediente;

    @NotNull(message = "La cédula asociada es obligatoria")
    @OneToOne
    @JoinColumn(name = "id_cedula", nullable = false, unique = true)
    private CedulaNotificacion cedula;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CedulaNotificacion.DestinatarioNotificacion destinatario;

    @Column(name = "destinatario_nombre", length = 200)
    private String destinatarioNombre;

    @Column(name = "destinatario_email", length = 150)
    private String destinatarioEmail;

    @Column(name = "fecha_notificacion", nullable = false)
    private LocalDateTime fechaNotificacion;

    @Column(length = 40)
    private String medio;

    @Column(length = 40)
    private String estado;

    @Column(columnDefinition = "TEXT")
    private String detalle;

    @PrePersist
    protected void onCreate() {
        fechaNotificacion = fechaNotificacion != null ? fechaNotificacion : LocalDateTime.now();
        medio = medio != null ? medio : "CASILLA_ELECTRONICA";
        estado = estado != null ? estado : "NOTIFICADA";
    }

    public Long getId() {
        return this.idNotificacion;
    }
}
