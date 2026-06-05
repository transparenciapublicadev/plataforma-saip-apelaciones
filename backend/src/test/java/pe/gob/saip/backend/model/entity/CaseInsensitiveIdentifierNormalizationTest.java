package pe.gob.saip.backend.model.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CaseInsensitiveIdentifierNormalizationTest {

    @Test
    void usuarioNormalizaEmailAntesDePersistirYActualizar() {
        Usuario usuario = new Usuario();
        usuario.setEmail("  Ciudadano@Example.COM  ");

        usuario.onCreate();

        assertThat(usuario.getEmail()).isEqualTo("ciudadano@example.com");

        usuario.setEmail("  OTRO@Example.COM ");
        usuario.onUpdate();

        assertThat(usuario.getEmail()).isEqualTo("otro@example.com");
    }

    @Test
    void entidadNormalizaAcronimoAntesDePersistirYActualizar() {
        Entidad entidad = new Entidad();
        entidad.setAcronimo("  minedu  ");

        entidad.onCreate();

        assertThat(entidad.getAcronimo()).isEqualTo("MINEDU");

        entidad.setAcronimo("  minsa ");
        entidad.onUpdate();

        assertThat(entidad.getAcronimo()).isEqualTo("MINSA");
    }
}
