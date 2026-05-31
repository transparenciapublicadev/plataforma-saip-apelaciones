package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "apelaciones", indexes = {
    @Index(name = "idx_apelacion_expediente", columnList = "expediente", unique = true),
    @Index(name = "idx_apelacion_solicitud", columnList = "id_solicitud"),
    @Index(name = "idx_apelacion_entidad_apelada", columnList = "id_entidad_apelada"),
    @Index(name = "idx_apelacion_ciudadano", columnList = "id_ciudadano"),
    @Index(name = "idx_apelacion_estado", columnList = "estado")
})
public class Apelacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_apelacion")
    private Long idApelacion;

    @Column(nullable = false, unique = true, length = 50)
    private String expediente;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToOne
    @JoinColumn(name = "id_solicitud", unique = true)
    private Solicitud solicitud;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_origen", nullable = false, length = 20)
    private TipoOrigenApelacion tipoOrigen;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @ManyToOne
    @JoinColumn(name = "id_entidad_apelada")
    private Entidad entidadApelada;

    @Column(name = "entidad_externa_nombre", length = 200)
    private String entidadExternaNombre;

    @Column(name = "entidad_externa_ruc", length = 20)
    private String entidadExternaRuc;

    @Column(name = "entidad_externa_email", length = 120)
    private String entidadExternaEmail;

    @Column(name = "numero_solicitud_externa", length = 100)
    private String numeroSolicitudExterna;

    @Column(name = "fecha_presentacion_solicitud_externa")
    private LocalDate fechaPresentacionSolicitudExterna;

    @Column(name = "fecha_respuesta_entidad")
    private LocalDate fechaRespuestaEntidad;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_denegatoria", length = 20)
    private TipoDenegatoria tipoDenegatoria;

    @Column(name = "resumen_solicitud_original", columnDefinition = "TEXT")
    private String resumenSolicitudOriginal;

    @Column(name = "resumen_respuesta_entidad", columnDefinition = "TEXT")
    private String resumenRespuestaEntidad;

    @Column(name = "referencia_documento_solicitud", length = 500)
    private String referenciaDocumentoSolicitud;

    @Column(name = "referencia_cargo_recepcion", length = 500)
    private String referenciaCargoRecepcion;

    @Column(name = "referencia_respuesta_entidad", length = 500)
    private String referenciaRespuestaEntidad;

    @Column(name = "evidencia_silencio_administrativo", columnDefinition = "TEXT")
    private String evidenciaSilencioAdministrativo;

    @Column(columnDefinition = "TEXT")
    private String observacion;

    @NotNull(message = "El ciudadano no puede ser nulo")
    @ManyToOne
    @JoinColumn(name = "id_ciudadano", nullable = false)
    private Ciudadano ciudadano;

    @NotBlank(message = "Los fundamentos no pueden estar vacíos")
    @Column(nullable = false, columnDefinition = "TEXT")
    private String fundamentos;

    @Column(name = "fecha_apelacion", nullable = false)
    private LocalDateTime fechaApelacion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EstadoApelacion estado;

    @Enumerated(EnumType.STRING)
    @Column(name = "calificacion_primera", length = 20)
    private Calificacion calificacionPrimera;

    @Enumerated(EnumType.STRING)
    @Column(name = "calificacion_segunda", length = 20)
    private Calificacion calificacionSegunda;

    @Column(name = "fecha_subsanacion")
    private LocalDate fechaSubsanacion;

    @Column(name = "dias_subsanacion")
    private Integer diasSubsanacion;

    @Column(length = 60)
    private String resultado;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "apelacion", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Documento> documentos;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToMany(mappedBy = "apelacion", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Resolucion> resoluciones;

    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    @OneToOne(mappedBy = "apelacion", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private ExpedienteTtaip expedienteTtaip;

    @PrePersist
    protected void onCreate() {
        fechaApelacion = LocalDateTime.now();
        if (estado == null) {
            estado = EstadoApelacion.EN_CALIFICACION_1;
        }
        if (tipoOrigen == null) {
            tipoOrigen = TipoOrigenApelacion.SAIP_INTERNA;
        }
    }

    /**
     * Estados de apelación — alineados con core/domain/model/Apelacion.kt (EstadoApelacion)
     */
    public enum EstadoApelacion {
        PENDIENTE_ELEVACION,
        EN_CALIFICACION_1,
        EN_SUBSANACION,
        EN_CALIFICACION_2,
        NOTIFICACION_SEGUNDA_CALIFICACION,
        EN_RESOLUCION,
        RESUELTO,
        TENER_POR_NO_PRESENTADO,
        CONCLUSION_SUSTRACCION_MATERIA,
        CONCLUSION_DESISTIMIENTO,
        RESUELTO_FUNDADO,
        RESUELTO_FUNDADO_EN_PARTE,
        RESUELTO_INFUNDADO,
        RESUELTO_INFUNDADO_EN_PARTE,
        RESUELTO_IMPROCEDENTE,
        RESUELTO_ESTESE_A_LO_RESUELTO,
        RESUELTO_NULIDAD_ACTO
    }

    public enum Calificacion {
        ADMISIBLE,
        INADMISIBLE,
        IMPROCEDENTE,
        ADMITIDO
    }

    public enum TipoOrigenApelacion {
        SAIP_INTERNA,
        EXTERNA
    }

    public enum TipoDenegatoria {
        EXPRESA,
        TACITA
    }

    public Long getId() {
        return this.idApelacion;
    }

    public Resolucion getResolucion() {
        if (resoluciones != null && !resoluciones.isEmpty()) {
            return resoluciones.stream()
                    .filter(r -> r.getTipoResolucion() == Resolucion.TipoResolucion.RESOLUCION_FINAL)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    public Resolucion getResolucionPrimeraCalificacion() {
        if (resoluciones != null && !resoluciones.isEmpty()) {
            return resoluciones.stream()
                    .filter(r -> r.getTipoResolucion() == Resolucion.TipoResolucion.PRIMERA_CALIFICACION)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    public Resolucion getResolucionSegundaCalificacion() {
        if (resoluciones != null && !resoluciones.isEmpty()) {
            return resoluciones.stream()
                    .filter(r -> r.getTipoResolucion() == Resolucion.TipoResolucion.SEGUNDA_CALIFICACION)
                    .findFirst()
                    .orElse(null);
        }
        return null;
    }

    public TipoOrigenApelacion getTipoOrigenEfectivo() {
        return tipoOrigen != null ? tipoOrigen : TipoOrigenApelacion.SAIP_INTERNA;
    }

    public Entidad getEntidadApeladaEfectiva() {
        if (solicitud != null && solicitud.getEntidad() != null) {
            return solicitud.getEntidad();
        }
        return entidadApelada;
    }

    public String getEntidadNombreEfectivo() {
        Entidad entidad = getEntidadApeladaEfectiva();
        return entidad != null ? entidad.getNombre() : entidadExternaNombre;
    }

    public String getEntidadEmailEfectivo() {
        Entidad entidad = getEntidadApeladaEfectiva();
        return entidad != null ? entidad.getEmail() : entidadExternaEmail;
    }

    /**
     * Verifica si la apelación está en un estado resuelto.
     */
    public boolean isResuelta() {
        return estado == EstadoApelacion.RESUELTO ||
               estado == EstadoApelacion.RESUELTO_FUNDADO ||
               estado == EstadoApelacion.RESUELTO_FUNDADO_EN_PARTE ||
               estado == EstadoApelacion.RESUELTO_INFUNDADO ||
               estado == EstadoApelacion.RESUELTO_INFUNDADO_EN_PARTE ||
               estado == EstadoApelacion.RESUELTO_IMPROCEDENTE ||
               estado == EstadoApelacion.RESUELTO_ESTESE_A_LO_RESUELTO ||
               estado == EstadoApelacion.RESUELTO_NULIDAD_ACTO ||
               estado == EstadoApelacion.TENER_POR_NO_PRESENTADO ||
               estado == EstadoApelacion.CONCLUSION_SUSTRACCION_MATERIA ||
               estado == EstadoApelacion.CONCLUSION_DESISTIMIENTO;
    }
}

