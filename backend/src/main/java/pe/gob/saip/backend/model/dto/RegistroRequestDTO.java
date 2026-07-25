package pe.gob.saip.backend.model.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import pe.gob.saip.backend.model.entity.TipoPersona;

@Schema(description = "Datos de registro de ciudadano (Persona Natural o Jurídica)")
public record RegistroRequestDTO(
        @NotBlank(message = "El email es requerido")
        @Email(message = "Formato de email inválido")
        @Schema(description = "Email del ciudadano", example = "ciudadano@email.com")
        String email,

        @NotBlank(message = "La contraseña es requerida")
        @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres")
        @Schema(description = "Contraseña (mín 6 caracteres)")
        String password,

        @Schema(description = "Tipo de persona: NATURAL o JURIDICA", example = "NATURAL")
        TipoPersona tipoPersona,

        // Persona Natural
        @Schema(description = "DNI de 8 dígitos (Persona Natural)", example = "12345678")
        String dni,

        @Schema(description = "Nombres de la persona natural", example = "Juan Carlos")
        String nombres,

        @Schema(description = "Apellido Paterno", example = "Pérez")
        String apellidoPaterno,

        @Schema(description = "Apellido Materno", example = "Gómez")
        String apellidoMaterno,

        @Schema(description = "Nombre completo del ciudadano")
        String nombreCompleto,

        // Persona Jurídica
        @Schema(description = "RUC de 11 dígitos (Persona Jurídica)", example = "20123456789")
        String ruc,

        @Schema(description = "Razón Social de la empresa", example = "Constructora del Sur S.A.C.")
        String razonSocial,

        @Schema(description = "DNI del Representante Legal", example = "87654321")
        String representanteDni,

        @Schema(description = "Nombre completo del Representante Legal", example = "María Elena Flores")
        String representanteNombreCompleto,

        // Contacto & Domicilio Estructurado
        @Size(max = 15, message = "El teléfono no puede exceder 15 caracteres")
        @Schema(description = "Número de teléfono", example = "987654321")
        String telefono,

        @Schema(description = "Código de Ubigeo de 6 dígitos", example = "150101")
        String ubigeo,

        @Schema(description = "Departamento", example = "LIMA")
        String departamento,

        @Schema(description = "Provincia", example = "LIMA")
        String provincia,

        @Schema(description = "Distrito", example = "SAN ISIDRO")
        String distrito,

        @Schema(description = "Tipo de Vía", example = "AVENIDA")
        String tipoVia,

        @Schema(description = "Nombre de Vía", example = "JAVIER PRADO OESTE")
        String nombreVia,

        @Schema(description = "Número o Lote", example = "1230")
        String numero,

        @Schema(description = "Interior o Dpto", example = "OFICINA 402")
        String interior,

        @Schema(description = "Referencia", example = "Cerca a la Av. Arequipa")
        String referencia,

        @Size(max = 300, message = "La dirección no puede exceder 300 caracteres")
        String direccion
) {}
