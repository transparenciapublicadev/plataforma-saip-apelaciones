package pe.gob.saip.backend.model.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import pe.gob.saip.backend.model.entity.ConfiguracionSistema;
import tools.jackson.databind.json.JsonMapper;

/** Decimal defaults and the existing numeric JSON/validation contract. */
class TarifasConfigDTOTest {
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void entityAndDtoKeepTheOriginalExactTenCentDefault() {
        ConfiguracionSistema config = new ConfiguracionSistema();
        assertThat(config.getCostoPorCopia()).isEqualTo(new BigDecimal("0.10"));
        assertThat(SystemConfigDTO.from(config).tarifas().costoPorCopia()).isEqualTo(new BigDecimal("0.10"));
    }

    @Test
    void jsonRemainsANumberAndDeserializesDirectlyToDecimalWithoutDouble() throws Exception {
        for (String amount : new String[]{"0.10", "0.29", "12345678.91", "99999999.99"}) {
            TarifasConfigDTO dto = new TarifasConfigDTO(new BigDecimal(amount));
            String body = json.writeValueAsString(dto);
            assertThat(body).isEqualTo("{\"costoPorCopia\":" + amount + "}");
            assertThat(json.readTree(body).path("costoPorCopia").isNumber()).isTrue();
            assertThat(json.readValue(body, TarifasConfigDTO.class).costoPorCopia()).isEqualTo(dto.costoPorCopia());
        }
    }

    @Test
    void nullAndNegativeAreStillRejectedAndNoRoundingOrNewScaleValidationIsIntroduced() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new TarifasConfigDTO(null))).hasSize(1);
            assertThat(validator.validate(new TarifasConfigDTO(new BigDecimal("-0.01")))).hasSize(1);
            for (String amount : new String[]{"0", "0.10", "0.29", "0.123"}) {
                TarifasConfigDTO dto = new TarifasConfigDTO(new BigDecimal(amount));
                assertThat(validator.validate(dto)).isEmpty();
                assertThat(dto.costoPorCopia()).isEqualTo(new BigDecimal(amount));
            }
        }
    }
}
