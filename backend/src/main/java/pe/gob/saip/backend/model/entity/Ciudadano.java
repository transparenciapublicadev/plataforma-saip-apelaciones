package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "ciudadanos")
@PrimaryKeyJoinColumn(name = "id_usuario")
public class Ciudadano extends Usuario {

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_persona", length = 20)
    private TipoPersona tipoPersona = TipoPersona.NATURAL;

    // Persona Natural
    @Column(length = 15)
    private String dni;

    @Column(length = 100)
    private String nombres;

    @Column(name = "apellido_paterno", length = 100)
    private String apellidoPaterno;

    @Column(name = "apellido_materno", length = 100)
    private String apellidoMaterno;

    @Column(name = "nombre_completo", length = 200)
    private String nombreCompleto;

    // Persona Jurídica
    @Column(length = 11)
    private String ruc;

    @Column(name = "razon_social", length = 200)
    private String razonSocial;

    @Column(name = "representante_dni", length = 15)
    private String representanteDni;

    @Column(name = "representante_nombre_completo", length = 200)
    private String representanteNombreCompleto;

    // Dirección Legal Estructurada
    @Column(length = 6)
    private String ubigeo;

    @Column(length = 100)
    private String departamento;

    @Column(length = 100)
    private String provincia;

    @Column(length = 100)
    private String distrito;

    @Column(name = "tipo_via", length = 50)
    private String tipoVia;

    @Column(name = "nombre_via", length = 150)
    private String nombreVia;

    @Column(length = 20)
    private String numero;

    @Column(length = 20)
    private String interior;

    @Column(length = 200)
    private String referencia;

    @Column(length = 15)
    private String telefono;

    @Column(length = 300)
    private String direccion;

    @OneToMany(mappedBy = "ciudadano", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Solicitud> solicitudes;

    @OneToMany(mappedBy = "ciudadano", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Apelacion> apelaciones;

    public Long getId() {
        return this.getIdUsuario();
    }

    public String getNombres() {
        if (this.nombres != null && !this.nombres.isBlank()) {
            return this.nombres;
        }
        return this.nombreCompleto != null ? this.nombreCompleto : this.razonSocial;
    }

    public String getNombreCompleto() {
        if (this.tipoPersona == TipoPersona.JURIDICA && this.razonSocial != null && !this.razonSocial.isBlank()) {
            return this.razonSocial;
        }
        if (this.nombreCompleto != null && !this.nombreCompleto.isBlank()) {
            return this.nombreCompleto;
        }
        StringBuilder sb = new StringBuilder();
        if (this.nombres != null) sb.append(this.nombres.trim());
        if (this.apellidoPaterno != null) sb.append(" ").append(this.apellidoPaterno.trim());
        if (this.apellidoMaterno != null) sb.append(" ").append(this.apellidoMaterno.trim());
        return sb.toString().trim();
    }
}
