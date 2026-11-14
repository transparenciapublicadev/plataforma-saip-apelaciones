package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import pe.gob.saip.backend.util.DiasHabilesUtil;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "solicitudes", indexes = {
    @Index(name = "idx_solicitud_expediente", columnList = "expediente", unique = true),
    @Index(name = "idx_solicitud_ciudadano", columnList = "id_ciudadano"),
    @Index(name = "idx_solicitud_entidad", columnList = "id_entidad"),
    @Index(name = "idx_solicitud_estado", columnList = "estado")
})
public class Solicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_solicitud")
    private Long idSolicitud;

    @Column(nullable = false, unique = true, length = 50)
    private String expediente;

    @NotBlank(message = "El asunto no puede estar vacío")
    @Column(nullable = false, length = 500)
    private String asunto;

    @NotBlank(message = "La descripción no puede estar vacía")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion;

    @NotNull(message = "El ciudadano no puede ser nulo")
    @ManyToOne
    @JoinColumn(name = "id_ciudadano", nullable = false)
    private Ciudadano ciudadano;

    @NotNull(message = "La entidad no puede ser nula")
    @ManyToOne
    @JoinColumn(name = "id_entidad", nullable = false)
    private Entidad entidad;

    @Column(name = "fecha_presentacion", nullable = false)
    private LocalDateTime fechaPresentacion;

    @Column(name = "fecha_limite", nullable = false)
    private LocalDate fechaLimite;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoSolicitud estado;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Prioridad prioridad;

    @Column(name = "formato_digital")
    private Boolean formatoDigital;

    @Column(name = "formato_fisico")
    private Boolean formatoFisico;

    @Column(name = "copia_simple")
    private Boolean copiaSimple;

    @Column(name = "copia_certificada")
    private Boolean copiaCertificada;

    @Column(name = "tipo_informacion", length = 100)
    private String tipoInformacion;

    @Column(name = "oficina_destinataria", length = 160)
    private String oficinaDestinataria;

    @Column(name = "area_responsable", length = 160)
    private String areaResponsable;

    @Column(name = "encargado_area", length = 160)
    private String encargadoArea;

    @Column(name = "fecha_asignacion_area")
    private LocalDate fechaAsignacionArea;

    @Column(name = "consentimiento_datos_personales")
    private Boolean consentimientoDatosPersonales;

    @Enumerated(EnumType.STRING)
    @Column(name = "canal_notificacion", length = 40)
    private CanalNotificacion canalNotificacion;

    @OneToOne(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private Respuesta respuesta;

    @OneToMany(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Documento> documentos;

    @OneToMany(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<ObservacionSolicitud> observaciones;

    @OneToMany(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<AmpliacionPlazoSolicitud> ampliacionesPlazo;

    @OneToMany(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<EncauzamientoSolicitud> encauzamientos;

    @OneToMany(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<LiquidacionCostoSolicitud> liquidacionesCosto;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToOne(mappedBy = "solicitud", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private Apelacion apelacion;

    /** Recovers the optional office the citizen wrote into the description before it had its own column. */
    public static String oficinaIndicada(String descripcion) {
        if (descripcion == null) return null;
        String marca = "[Oficina destinataria: ";
        int inicio = descripcion.indexOf(marca);
        if (inicio < 0) return null;
        int desde = inicio + marca.length();
        int fin = descripcion.indexOf(']', desde);
        if (fin < 0) return null;
        String valor = descripcion.substring(desde, fin).trim();
        if (valor.isEmpty()) return null;
        return valor.length() > 160 ? valor.substring(0, 160) : valor;
    }

    public void registrarOficinaDesdeDescripcion() {
        String indicada = oficinaIndicada(descripcion);
        if (indicada != null) oficinaDestinataria = indicada;
    }

    @PrePersist
    protected void onCreate() {
        fechaPresentacion = LocalDateTime.now();
        // BR-SAIP-001/002: Plazo de 10 días hábiles (excluye fines de semana y feriados peruanos)
        fechaLimite = DiasHabilesUtil.sumarDiasHabiles(LocalDate.now(), 10);
        if (estado == null) {
            estado = EstadoSolicitud.RECEPCIONADA;
        }
        if (prioridad == null) {
            prioridad = Prioridad.MEDIA;
        }
        if (consentimientoDatosPersonales == null) {
            consentimientoDatosPersonales = false;
        }
        if (canalNotificacion == null) {
            canalNotificacion = CanalNotificacion.CASILLA_ELECTRONICA;
        }
    }

    /**
     * Estados de solicitud SAIP — alineados con core/domain/model/Solicitud.kt
     */
    public enum EstadoSolicitud {
        RECEPCIONADA,
        EN_REVISION,
        PENDIENTE_INFORMACION,
        RESPONDIDA,
        DENEGADA,
        CONCLUIDA,
        VENCIDA
    }

    /**
     * Prioridades — alineadas con core/domain
     */
    public enum Prioridad {
        BAJA,
        NORMAL,
        MEDIA,
        ALTA,
        URGENTE
    }

    public enum CanalNotificacion {
        CORREO_ELECTRONICO,
        CASILLA_ELECTRONICA,
        PLATAFORMA,
        FISICA
    }

    public Long getId() {
        return this.idSolicitud;
    }

    /**
     * Calcula días hábiles restantes hasta la fecha límite.
     * Negativo si ya venció.
     */
    public int getDiasRestantes() {
        if (fechaLimite == null) {
            return 0;
        }
        LocalDate ancla = fechaPresentacion == null ? null : fechaPresentacion.toLocalDate();
        return DiasHabilesUtil.diasHabilesVigentes(ancla, fechaLimite);
    }

    /**
     * BR-SAIP-005: Verifica si aplica silencio administrativo negativo.
     */
    public boolean isSilencioAdministrativo() {
        return getDiasRestantes() < 0 &&
               estado != EstadoSolicitud.RESPONDIDA &&
               estado != EstadoSolicitud.DENEGADA &&
               estado != EstadoSolicitud.CONCLUIDA &&
               estado != EstadoSolicitud.VENCIDA;
    }

    /**
     * Semáforo de estado según días restantes.
     * Verde (5+), Ámbar (2-4), Rojo (0-1), Negro (vencido)
     */
    public String getSemaforo() {
        return semaforoParaDiasRestantes(getDiasRestantes());
    }

    public static String semaforoParaDiasRestantes(int dias) {
        if (dias < 0) return "NEGRO";
        if (dias <= 1) return "ROJO";
        if (dias <= 4) return "AMBAR";
        return "VERDE";
    }
}
