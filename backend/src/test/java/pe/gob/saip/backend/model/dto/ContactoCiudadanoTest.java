package pe.gob.saip.backend.model.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ContactoCiudadanoTest {

    @Test
    void acceptsContactFieldsAndClearsBlankOptionals() {
        ContactoCiudadano contacto = ContactoCiudadano.validar(
                "  Ana Ruiz  ", " ana@correo.pe ", "987654321", "  ", "Lima", "Lima", "Miraflores");

        assertThat(contacto.nombreCompleto()).isEqualTo("Ana Ruiz");
        assertThat(contacto.email()).isEqualTo("ana@correo.pe");
        assertThat(contacto.telefono()).isEqualTo("987654321");
        assertThat(contacto.direccion()).isNull();
        assertThat(contacto.distrito()).isEqualTo("Miraflores");
    }

    @Test
    void rejectsAShortNameAnInvalidMailAndALandline() {
        assertThatThrownBy(() -> ContactoCiudadano.validar("An", "ana@correo.pe", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Escribe tu nombre completo.");
        assertThatThrownBy(() -> ContactoCiudadano.validar("Ana Ruiz", "ana", null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Escribe un correo válido.");
        assertThatThrownBy(() -> ContactoCiudadano.validar("Ana Ruiz", "ana@correo.pe", "014567890", null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("El celular debe tener 9 números y empezar con 9.");
    }
}
