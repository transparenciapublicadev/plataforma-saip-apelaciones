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

    @Column(name = "medio_notificacion", length = 40)
    private String medioNotificacion;

    @Column(length = 40)
    private String estado;

    @Column(columnDefinition = "TEXT")
    private String detalle;

    @Column(name = "fecha_envio")
    private LocalDateTime fechaEnvio;

    @Column(name = "codigo_envio", length = 80)
    private String codigoEnvio;

    @Column(name = "codigo_constancia", length = 80)
    private String codigoConstancia;

    @Column(name = "constancia_envio", columnDefinition = "TEXT")
    private String constanciaEnvio;

    @Column(name = "acuse_automatico", columnDefinition = "TEXT")
    private String acuseAutomatico;

    @Column(name = "fecha_acuse")
    private LocalDateTime fechaAcuse;

    @Column(name = "estado_acuse", length = 40)
    private String estadoAcuse;

    @Column(name = "resultado_notificacion", length = 80)
    private String resultadoNotificacion;

    @Column(name = "evidencia_url", length = 500)
    private String evidenciaUrl;

    @Column(name = "referencia_evidencia", length = 500)
    private String referenciaEvidencia;

    @Column(name = "validada_manualmente", nullable = false)
    private Boolean validadaManualmente;

    @Column(name = "fecha_validacion_manual")
    private LocalDateTime fechaValidacionManual;

    @Column(name = "responsable_validacion", length = 120)
    private String responsableValidacion;

    @Column(name = "observacion_validacion", columnDefinition = "TEXT")
    private String observacionValidacion;

    @Column(name = "responsable_constancia", length = 120)
    private String responsableConstancia;

    @Column(name = "observacion_constancia", columnDefinition = "TEXT")
    private String observacionConstancia;

    @Column(columnDefinition = "TEXT")
    private String trazabilidad;

    @Column(name = "direccion_destino", length = 500)
    private String direccionDestino;

    @Column(name = "fecha_eficacia")
    private LocalDateTime fechaEficacia;

    @PrePersist
    protected void onCreate() {
        fechaNotificacion = fechaNotificacion != null ? fechaNotificacion : LocalDateTime.now();
        medio = medio != null ? medio : "CASILLA_ELECTRONICA";
        medioNotificacion = medioNotificacion != null ? medioNotificacion : medio;
        estado = estado != null ? estado : "PENDIENTE";
        resultadoNotificacion = resultadoNotificacion != null ? resultadoNotificacion : estado;
        estadoAcuse = estadoAcuse != null ? estadoAcuse : "PENDIENTE";
        validadaManualmente = validadaManualmente != null ? validadaManualmente : Boolean.FALSE;
    }

    public Long getId() {
        return this.idNotificacion;
    }
}
