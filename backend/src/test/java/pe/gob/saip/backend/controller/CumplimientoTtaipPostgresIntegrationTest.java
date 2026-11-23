package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real login, security, JPA, transactions and PostgreSQL; only external notifications use MOCK. */
@EnabledIfEnvironmentVariable(named = "RUN_CUMPLIMIENTO_POSTGRES_TESTS", matches = "true")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
    "server.address=127.0.0.1", "spring.flyway.enabled=true",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
    "spring.flyway.clean-disabled=true", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "springdoc.default-produces-media-type=application/json",
    "springdoc.default-consumes-media-type=application/json",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class CumplimientoTtaipPostgresIntegrationTest {
    private static final Path ROOT = directorioPropio();
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired PasswordEncoder encoder;
    @Autowired PlatformTransactionManager manager;
    @Autowired UsuarioRepository usuarios;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired FuncionarioRepository funcionarios;
    @Autowired EntidadRepository entidades;
    @Autowired SalaTtaipRepository salas;
    @Autowired ApelacionRepository apelaciones;
    @Autowired ExpedienteTtaipRepository expedientes;
    @Autowired ResolucionRepository resoluciones;
    @Autowired Flyway flyway;
    @LocalServerPort int port;
    private String passwordHash;
    private Long expedienteId, resolucionId, otroExpedienteId;

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry r) {
        String url = System.getenv("TTAIP_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base temporal propia de pruebas en loopback");
        r.add("spring.datasource.url", () -> url);
        r.add("spring.datasource.username", () -> "yaiku_e11_test");
        r.add("spring.datasource.password", () -> "");
        r.add("app.storage.local.base-path", () -> ROOT.toString());
    }
    static Path directorioPropio() {
        try { return Files.createTempDirectory("yaiku-cumplimiento-"); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    @AfterAll static void limpiarDirectorioPropio() throws Exception {
        Path temp = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        Path owned = ROOT.toAbsolutePath().normalize();
        if (!owned.getParent().equals(temp) || !owned.getFileName().toString().startsWith("yaiku-cumplimiento-"))
            throw new IllegalStateException("Ruta temporal fuera de alcance");
        try (var walk = Files.walk(owned)) {
            for (Path p : walk.sorted(Comparator.reverseOrder()).toList()) Files.delete(p);
        }
    }
    @BeforeEach void preparar() {
        jdbc.execute("TRUNCATE usuarios, entidades, salas_ttaip RESTART IDENTITY CASCADE");
        passwordHash = encoder.encode("Sintetico-2026!");
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            Usuario tribunal = new Usuario(); tribunal.setEmail("tribunal@example.invalid");
            tribunal.setPassword(passwordHash); tribunal.setTipoUsuario(Usuario.TipoUsuario.TTAIP); usuarios.saveAndFlush(tribunal);
            Ciudadano c = new Ciudadano(); c.setEmail("persona@example.invalid"); c.setPassword(passwordHash);
            c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO); c.setNombreCompleto("Persona sintética"); c.setDni("00000001");
            ciudadanos.saveAndFlush(c);
            Entidad entidad = entidad("Entidad sintética", "SINT");
            funcionario("funcionario@example.invalid", entidad);
            funcionario("ajeno@example.invalid", entidad("Otra entidad sintética", "OTRA"));
            SalaTtaip sala = new SalaTtaip(); sala.setNombre("Sala sintética");
            sala.setPeriodoInicio(LocalDate.of(2025, 1, 1)); sala.setPeriodoFin(LocalDate.of(2035, 1, 1)); salas.saveAndFlush(sala);
            ExpedienteTtaip exp = expediente(c, entidad, sala, "00001-2026-JUS/TTAIP"); expedienteId = exp.getId();
            otroExpedienteId = expediente(c, entidad, sala, "00002-2026-JUS/TTAIP").getId();
            Resolucion r = new Resolucion(); r.setApelacion(exp.getApelacion()); r.setExpedienteTtaip(exp);
            r.setSalaTtaip(sala); r.setTipoResolucion(Resolucion.TipoResolucion.RESOLUCION_FINAL);
            r.setDecision(Resolucion.DecisionResolucion.FUNDADO); r.setFundamentos("Fundamento sintético");
            r.setNumeroResolucion("00001-2026-JUS/TTAIP-SINT"); resolucionId = resoluciones.saveAndFlush(r).getId();
        });
    }
    Entidad entidad(String nombre, String acronimo) {
        Entidad e = new Entidad(); e.setNombre(nombre); e.setAcronimo(acronimo); return entidades.saveAndFlush(e);
    }
    void funcionario(String email, Entidad entidad) {
        Funcionario f = new Funcionario(); f.setEmail(email); f.setPassword(passwordHash);
        f.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO); f.setNombreCompleto("Funcionario sintético"); f.setEntidad(entidad);
        funcionarios.saveAndFlush(f);
    }
    ExpedienteTtaip expediente(Ciudadano c, Entidad e, SalaTtaip sala, String numero) {
        Apelacion ap = new Apelacion(); ap.setCiudadano(c); ap.setEntidadApelada(e);
        ap.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA); ap.setFundamentos("Fundamentos sintéticos");
        ap.setExpediente(numero); ap.setEstado(Apelacion.EstadoApelacion.RESUELTO_FUNDADO); apelaciones.saveAndFlush(ap);
        ExpedienteTtaip exp = new ExpedienteTtaip(); exp.setApelacion(ap); exp.setSala(sala); exp.setNumeroExpediente(numero);
        exp.setEstado(ap.getEstado()); return expedientes.saveAndFlush(exp);
    }
    String login(String email) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("identificador", email, "password", "Sintetico-2026!"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("token").asString();
    }
    String base() { return "/api/ttaip/expedientes/" + expedienteId + "/cumplimientos"; }
    long crear(String token) throws Exception {
        // Explicit synthetic base avoids exercising or endorsing the legacy notification-date fallback.
        String body = mvc.perform(post("/api/ttaip/expedientes/" + expedienteId + "/resoluciones/" + resolucionId + "/cumplimientos")
                .header("Authorization", "Bearer " + token).contentType("application/json")
                .content("{\"fechaRequerimientoCumplimiento\":\"2026-10-20\",\"observacion\":\"Base sintética explícita\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("id").asLong();
    }
    ResultActions actuar(long id, String accion, String body, String token) throws Exception {
        return mvc.perform(patch(base() + "/" + id + "/" + accion).header("Authorization", "Bearer " + token)
                .contentType("application/json").content(body));
    }
    JsonNode consultar(String token) throws Exception {
        return json.readTree(mvc.perform(get(base()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    @Test void consultaPersistidaObservacionCierreYRecargaConTrazabilidad() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t);
        assertThat(consultar(t).get(0).path("id").asLong()).isEqualTo(id);
        actuar(id, "observar", "{\"observacion\":\"Solicitar evidencia completa\"}", t).andExpect(status().isOk());
        JsonNode observado = consultar(t).get(0);
        assertThat(observado.path("estadoCumplimiento").asString()).isEqualTo("OBSERVADO");
        assertThat(observado.path("trazabilidad").asString()).contains("Solicitar evidencia completa");
        actuar(id, "cerrar", "{\"observacion\":\"Cierre operativo sustentado\"}", t).andExpect(status().isOk());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("CERRADO");
        assertThat(jdbc.queryForObject("select count(*) from historial_ttaip where tipo_evento in ('CUMPLIMIENTO_OBSERVADO','CUMPLIMIENTO_CERRADO')", Long.class)).isEqualTo(2);
        String body = mvc.perform(get("/api/ttaip/resueltas").header("Authorization", "Bearer " + t))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(body).contains("CERRADO", "Cierre operativo sustentado");
    }
    @Test void vacioRealYValidacionNoSeConviertenEnCumplimiento() throws Exception {
        String t = login("tribunal@example.invalid"); assertThat(consultar(t).isEmpty()).isTrue(); long id = crear(t);
        actuar(id, "observar", "{\"observacion\":\" \"}", t).andExpect(status().isBadRequest());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("PENDIENTE");
        assertThat(jdbc.queryForObject("select count(*) from historial_ttaip where tipo_evento='CUMPLIMIENTO_OBSERVADO'", Long.class)).isZero();
    }
    @Test void cerradoNoPuedeObservarseNiCerrarseDeNuevo() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t);
        actuar(id, "cerrar", "{}", t).andExpect(status().isOk());
        actuar(id, "observar", "{\"observacion\":\"Intento inválido\"}", t).andExpect(status().isBadRequest());
        actuar(id, "cerrar", "{}", t).andExpect(status().isBadRequest());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("CERRADO");
        assertThat(jdbc.queryForObject("select count(*) from historial_ttaip where tipo_evento='CUMPLIMIENTO_CERRADO'", Long.class)).isEqualTo(1);
    }
    @Test void ciudadanoYFuncionarioNoPuedenEjecutarActuacionesDelTribunal() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t);
        for (String email : List.of("persona@example.invalid", "funcionario@example.invalid")) {
            String token = login(email);
            actuar(id, "cerrar", "{}", token).andExpect(status().isForbidden());
            actuar(id, "observar", "{\"observacion\":\"No autorizado\"}", token).andExpect(status().isForbidden());
        }
        mvc.perform(get(base())).andExpect(status().isUnauthorized());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("PENDIENTE");
    }
    @Test void funcionarioAjenoNoConsultaNiRegistraCumplimiento() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t); String ajeno = login("ajeno@example.invalid");
        mvc.perform(get(base()).header("Authorization", "Bearer " + ajeno)).andExpect(status().isForbidden());
        mvc.perform(post(base() + "/" + id + "/registrar").header("Authorization", "Bearer " + ajeno)
                .contentType("application/json").content(comunicacion())).andExpect(status().isForbidden());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("PENDIENTE");
    }
    String comunicacion() {
        return "{\"tipoCumplimiento\":\"TOTAL\",\"descripcionCumplimiento\":\"Entrega comunicada\",\"referenciaDocumento\":\"CARGO-SINTETICO\",\"responsableEntidad\":\"Responsable sintético\"}";
    }
    @Test void comunicacionDeLaEntidadEsElComandoQueRegistraCumplido() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t);
        mvc.perform(post(base() + "/" + id + "/registrar").header("Authorization", "Bearer " + login("funcionario@example.invalid"))
                .contentType("application/json").content(comunicacion())).andExpect(status().isOk());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("CUMPLIDO");
        assertThat(consultar(t).get(0).path("referenciaDocumento").asString()).isEqualTo("CARGO-SINTETICO");
    }
    @Test void noPermiteUsarUnSeguimientoEnOtroExpediente() throws Exception {
        String t = login("tribunal@example.invalid"); long id = crear(t);
        mvc.perform(patch("/api/ttaip/expedientes/" + otroExpedienteId + "/cumplimientos/" + id + "/cerrar")
                .header("Authorization", "Bearer " + t).contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        actuar(999999L, "cerrar", "{}", t).andExpect(status().isNotFound());
        assertThat(consultar(t).get(0).path("estadoCumplimiento").asString()).isEqualTo("PENDIENTE");
    }
    @Test void flywayValidateYContratoCompletoReal() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(jdbc.queryForList("select version from flyway_schema_history where success", String.class))
                .contains("12", "26");
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where not success", Long.class)).isZero();
        var response = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v3/api-docs")).GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        Path output = Path.of(Objects.requireNonNull(System.getenv("TTAIP_POSTGRES_ARTIFACTS")));
        Files.createDirectories(output); Files.writeString(output.resolve("openapi-live.json"), response.body());
        JsonNode spec = json.readTree(response.body());
        assertThat(spec.path("paths").has("/api/ttaip/expedientes/{expedienteId}/cumplimientos/{cumplimientoId}/observar")).isTrue();
        assertThat(spec.path("components").path("schemas").has("CumplimientoResolucionTtaipDTO")).isTrue();
        Files.writeString(output.resolve("flyway-historial.txt"), jdbc.queryForList("select version, description, checksum, success from flyway_schema_history order by installed_rank").toString());
    }
}
