package pe.gob.saip.backend.repository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("postgres")
@EnabledIfEnvironmentVariable(named = "RUN_POSTGRES_INTEGRATION_TESTS", matches = "true")
@Transactional(readOnly = true)
class PostgresCaseInsensitiveRepositoryIntegrationTest {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CiudadanoRepository ciudadanoRepository;

    @Autowired
    private FuncionarioRepository funcionarioRepository;

    @Autowired
    private MiembroTTAIPRepository miembroTTAIPRepository;

    @Autowired
    private EntidadRepository entidadRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void buscaEmailYAcronimoSinDistinguirMayusculas() {
        assertThat(usuarioRepository.findByEmail("CIUDADANO01@GMAIL.COM")).isPresent();
        assertThat(ciudadanoRepository.findByEmail("CIUDADANO01@GMAIL.COM")).isPresent();
        assertThat(funcionarioRepository.findByEmail("FUNC.MINEDU@MINEDU.GOB.PE")).isPresent();
        assertThat(miembroTTAIPRepository.findByEmail("TVALVERDE@MINJUS.GOB.PE")).isPresent();
        assertThat(entidadRepository.findByAcronimo("minedu")).isPresent();
    }

    @Test
    void schemaIncluyeIndicesUnicosFuncionales() {
        Integer total = jdbcTemplate.queryForObject("""
                select count(*)
                from pg_indexes
                where schemaname = 'public'
                  and indexname in ('uq_usuarios_email_lower', 'uq_entidades_acronimo_lower')
                """, Integer.class);

        assertThat(total).isEqualTo(2);
    }
}
