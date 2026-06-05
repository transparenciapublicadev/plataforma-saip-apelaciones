package pe.gob.saip.backend.model.entity;

import jakarta.persistence.FetchType;
import jakarta.persistence.ManyToOne;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ReprocesoNotificacionMappingTest {

    @Test
    void associationsUseLazyLoadingToAvoidRecursiveAggregateQueries() throws NoSuchFieldException {
        for (String fieldName : List.of(
                "expediente",
                "notificacion",
                "cedulaOriginal",
                "cedulaNueva",
                "notificacionNueva",
                "reprocesoPadre"
        )) {
            Field field = ReprocesoNotificacion.class.getDeclaredField(fieldName);
            ManyToOne association = field.getAnnotation(ManyToOne.class);

            assertThat(association)
                    .as("ManyToOne mapping for %s", fieldName)
                    .isNotNull();
            assertThat(association.fetch())
                    .as("fetch mode for %s", fieldName)
                    .isEqualTo(FetchType.LAZY);
        }
    }
}
