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
@ActiveProfiles("postgres-integration")
@EnabledIfEnvironmentVariable(named = "RUN_POSTGRES_INTEGRATION_TESTS", matches = "true")
@Transactional
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

    @Test
    void persisteMetadatosDocumentalesSinGuardarBinarios() {
        Long documentoId = jdbcTemplate.queryForObject("""
                insert into documentos (
                    nombre_archivo,
                    ruta_archivo,
                    tipo_archivo,
                    tamanio,
                    hash_sha256,
                    storage_provider,
                    storage_bucket,
                    tipo_documento,
                    estado,
                    id_creado_por,
                    id_solicitud
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                returning id_documento
                """,
                Long.class,
                "documento-prueba.pdf",
                "2026/06/00000000-0000-0000-0000-000000000001.pdf",
                "application/pdf",
                128L,
                "a".repeat(64),
                "S3_COMPATIBLE",
                "saip-documents-test",
                "DOCUMENTO_ADJUNTO",
                "ACTIVO",
                1L,
                1L);

        String hash = jdbcTemplate.queryForObject(
                "select hash_sha256 from documentos where id_documento = ?",
                String.class,
                documentoId);
        String storageProvider = jdbcTemplate.queryForObject(
                "select storage_provider from documentos where id_documento = ?",
                String.class,
                documentoId);
        Integer binaryColumns = jdbcTemplate.queryForObject("""
                select count(*)
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'documentos'
                  and data_type = 'bytea'
                """, Integer.class);

        assertThat(hash).isEqualTo("a".repeat(64));
        assertThat(storageProvider).isEqualTo("S3_COMPATIBLE");
        assertThat(binaryColumns).isZero();
    }
}
