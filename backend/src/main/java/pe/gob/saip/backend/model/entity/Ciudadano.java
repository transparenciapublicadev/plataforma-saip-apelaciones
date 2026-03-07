package pe.gob.saip.backend.model.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
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

    @NotBlank(message = "El DNI no puede estar vacío")
    @Pattern(regexp = "\\d{8}", message = "El DNI debe tener 8 dígitos")
    @Column(nullable = false, unique = true, length = 8)
    private String dni;

    @NotBlank(message = "El nombre completo no puede estar vacío")
    @Column(name = "nombre_completo", nullable = false, length = 200)
    private String nombreCompleto;

    @Column(length = 15)
    private String telefono;

    @Column(length = 200)
    private String direccion;

    @OneToMany(mappedBy = "ciudadano", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Solicitud> solicitudes;

    @OneToMany(mappedBy = "ciudadano", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private List<Apelacion> apelaciones;

    public Long getId() {
        return this.getIdUsuario();
    }

    public String getNombres() {
        return this.nombreCompleto;
    }
}
