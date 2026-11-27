package pe.gob.saip.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.gob.saip.backend.model.entity.Apelacion;
import pe.gob.saip.backend.model.entity.Resolucion;
import pe.gob.saip.backend.repository.ResolucionRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResolucionServiceTest {

    @Mock
    ResolucionRepository resolucionRepository;

    @InjectMocks
    ResolucionService service;

    @Test
    void identificaLasApelacionesQueTienenResolucionFinal() {
        Apelacion conFinal = new Apelacion();
        conFinal.setIdApelacion(7L);
        Resolucion final_ = new Resolucion();
        final_.setApelacion(conFinal);

        Resolucion sinApelacion = new Resolucion();

        when(resolucionRepository.findByTipoResolucion(Resolucion.TipoResolucion.RESOLUCION_FINAL))
                .thenReturn(List.of(final_, sinApelacion));

        assertThat(service.idsDeApelacionesConResolucionFinal()).containsExactly(7L);
    }
}
