package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.scheduler.PlazoAlertaScheduler;
import pe.gob.saip.backend.service.SolicitudService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real authentication, JPA and PostgreSQL. Only external notification providers use MOCK. */
@EnabledIfEnvironmentVariable(named="RUN_RESPUESTA_POSTGRES_TESTS", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "server.address=127.0.0.1", "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "springdoc.default-produces-media-type=application/json", "springdoc.default-consumes-media-type=application/json",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import(RespuestaSaipRecepcionPostgresIntegrationTest.DescartarConfirmacion.class)
class RespuestaSaipRecepcionPostgresIntegrationTest {
    private static final Path LOCAL=temporal();
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired PlatformTransactionManager manager;
    @Autowired UsuarioRepository usuarios;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired FuncionarioRepository funcionarios;
    @Autowired EntidadRepository entidades;
    @Autowired SolicitudRepository solicitudes;
    @Autowired SolicitudService servicio;
    @Autowired PlazoAlertaScheduler scheduler;
    @Autowired Flyway flyway;
    @LocalServerPort int port;
    long solicitudId, funcionarioId, ciudadanoId, entidadId, otraEntidadId;
    String token;

    @DynamicPropertySource static void propiedades(DynamicPropertyRegistry r) {
        String url=System.getenv("RESPUESTA_POSTGRES_URL");
        if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base propia temporal en loopback");
        r.add("spring.datasource.url",()->url); r.add("spring.datasource.username",()->"yaiku_e11_test");
        r.add("spring.datasource.password",()->""); r.add("app.storage.local.base-path",()->LOCAL.toString());
    }
    static Path temporal() {
        try {return Files.createTempDirectory("yaiku-r3-saip-local-");}
        catch(Exception e){throw new IllegalStateException(e);}
    }
    @BeforeEach void preparar() throws Exception {
        jdbc.execute("TRUNCATE usuarios, entidades RESTART IDENTITY CASCADE");
        try(var paths=Files.walk(LOCAL)) { for(Path path:paths.filter(Files::isRegularFile).toList()) Files.delete(path); }
        String hash=encoder.encode("Sintetico-2026!");
        new TransactionTemplate(manager).executeWithoutResult(tx->{
            Ciudadano c=ciudadano("persona@example.invalid","00000001",hash); ciudadanoId=c.getId();
            ciudadano("otra@example.invalid","00000002",hash);
            Entidad e=entidad("Entidad sintética","SINT"); entidadId=e.getId();
            Entidad otra=entidad("Otra entidad sintética","OTRA"); otraEntidadId=otra.getId();
            funcionarioId=funcionario("funcionario@example.invalid",hash,e).getId(); funcionario("ajeno@example.invalid",hash,otra); funcionario("colega@example.invalid",hash,e);
            Usuario a=new Usuario(); a.setEmail("admin@example.invalid"); a.setPassword(hash);
            a.setTipoUsuario(Usuario.TipoUsuario.ADMINISTRADOR); usuarios.saveAndFlush(a);
            Solicitud s=new Solicitud(); s.setExpediente("SAIP-2026-00001"); s.setAsunto("Asunto original");
            s.setDescripcion("Descripción sintética"); s.setCiudadano(c); s.setEntidad(e);
            s.setEstado(Solicitud.EstadoSolicitud.RECEPCIONADA); s.setConsentimientoDatosPersonales(true);
            s.setCanalNotificacion(Solicitud.CanalNotificacion.PLATAFORMA); s.setFormatoDigital(true);
            solicitudes.saveAndFlush(s); solicitudId=s.getId();
        });
        token=login("funcionario@example.invalid");
    }
    Ciudadano ciudadano(String email,String dni,String hash){
        Ciudadano c=new Ciudadano();c.setEmail(email);c.setDni(dni);c.setNombreCompleto("Persona sintética");
        c.setPassword(hash);c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);return ciudadanos.saveAndFlush(c);
    }
    Entidad entidad(String nombre,String acronimo){Entidad e=new Entidad();e.setNombre(nombre);e.setAcronimo(acronimo);return entidades.saveAndFlush(e);}
    Funcionario funcionario(String email,String hash,Entidad entidad){
        Funcionario f=new Funcionario();f.setEmail(email);f.setPassword(hash);f.setNombreCompleto("Funcionario sintético");
        f.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);f.setEntidad(entidad);return funcionarios.saveAndFlush(f);
    }
    String login(String email) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("identificador",email,"password","Sintetico-2026!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("token").asString();
    }
    String base(){return "/api/solicitudes/"+solicitudId;}
    String estado(){return jdbc.queryForObject("select estado from solicitudes where id_solicitud=?",String.class,solicitudId);}
    List<Long> actuaciones(){return List.of("respuestas","observaciones_solicitud","documentos","ampliaciones_plazo_solicitud",
        "encauzamientos_solicitud","liquidaciones_costo_solicitud","intentos_notificacion").stream()
        .map(t->jdbc.queryForObject("select count(*) from "+t,Long.class)).toList();}
    String respuesta(String tipo) throws Exception {return json.writeValueAsString(Map.of("solicitudId",solicitudId,
        "funcionarioId",funcionarioId,"tipoRespuesta",tipo,"contenido","Información sintética aportada por el operador",
        "causalDenegatoria","Causal de prueba aportada","fundamentoLegal","Referencia de prueba aportada"));}
    ResultActions responder(String ruta,String tipo) throws Exception {return mvc.perform(post("/api/respuestas"+ruta)
        .header("Authorization","Bearer "+token).contentType("application/json").content(respuesta(tipo)));}
    long observar() throws Exception {return json.readTree(mvc.perform(post(base()+"/observaciones")
        .header("Authorization","Bearer "+token).contentType("application/json")
        .content("{\"motivoObservacion\":\"Precisar el periodo solicitado\",\"responsable\":\"Operador sintético\"}"))
        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asLong();}


    @Test void reproduceSecuenciaLegacyConRespuestaSinArchivoSeleccionado() throws Exception {
        responder("","ENTREGA_TOTAL").andExpect(status().isCreated());
        mvc.perform(multipart("/api/documentos/upload")
            .file(new MockMultipartFile("file","fallido.pdf","application/pdf",new byte[0]))
            .param("tipoDocumento","RESPUESTA_ENTIDAD").param("respuestaId","1")
            .header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        // Characterization: legacy JSON cannot know which files a later request selected.
        assertThat(estado()).isEqualTo("RESPONDIDA");
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isZero();
    }
    @Test void recepcionCoordinadaNoConfirmaArchivoVacio() throws Exception {
        mvc.perform(multipart("/api/respuestas/solicitud/"+solicitudId+"/recepciones")
            .file(new MockMultipartFile("archivos","fallido.pdf","application/pdf",new byte[0]))
            .param("claveOperacion",UUID.randomUUID().toString()).param("tipoRespuesta","ENTREGA_TOTAL")
            .param("contenido","Información sintética aportada")
            .header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(estado()).isEqualTo("RECEPCIONADA");
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isZero();
    }

    private static final byte[] PDF="%PDF-1.4\nContenido sintético verificable\n%%EOF".getBytes(StandardCharsets.UTF_8);
    String recepcion(){return "/api/respuestas/solicitud/"+solicitudId+"/recepciones";}
    org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder envio(String clave,String tipo,MockMultipartFile...files){
        var builder=multipart(recepcion()).param("claveOperacion",clave).param("tipoRespuesta",tipo)
            .param("contenido","Información sintética aportada").param("causalDenegatoria","Causal aportada")
            .param("fundamentoLegal","Fundamento aportado").header("Authorization","Bearer "+token);
        for(var f:files)builder.file(f);return builder;
    }
    MockMultipartFile pdf(String nombre){return new MockMultipartFile("archivos",nombre,"application/pdf",PDF);}
    long archivos() throws IOException {try(var p=Files.walk(LOCAL)){return p.filter(Files::isRegularFile).count();}}
    void sinEfectos() throws IOException {
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(archivos()).isZero();
        for(String tabla:List.of("respuestas","documentos","recepciones_respuesta_saip","recepcion_respuesta_saip_documentos"))
            assertThat(jdbc.queryForObject("select count(*) from "+tabla,Long.class)).as(tabla).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"ENTREGA_TOTAL","ENTREGA_PARCIAL","DENEGACION_TOTAL"})
    void recibeBytesYRecuperaRespuestaConDocumentosCorrectos(String tipo) throws Exception {
        String clave=UUID.randomUUID().toString();
        var dto=json.readTree(mvc.perform(envio(clave,tipo,pdf("primero.pdf"),pdf("segundo.pdf")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long respuestaId=dto.path("respuesta").path("id").asLong();
        assertThat(dto.path("solicitudId").asLong()).isEqualTo(solicitudId);
        assertThat(dto.path("documentos").size()).isEqualTo(2);assertThat(archivos()).isEqualTo(2);
        assertThat(estado()).isEqualTo(tipo.equals("DENEGACION_TOTAL")?"DENEGADA":"RESPONDIDA");
        if(!tipo.equals("ENTREGA_TOTAL")) {
            assertThat(dto.path("respuesta").path("causalDenegatoria").asString()).isEqualTo("Causal aportada");
            assertThat(dto.path("respuesta").path("fundamentoLegal").asString()).isEqualTo("Fundamento aportado");
        }
        for(var doc:dto.path("documentos")) {
            assertThat(doc.path("respuestaId").asLong()).isEqualTo(respuestaId);
            assertThat(doc.path("solicitudId").isNull()).isTrue();
            assertThat(doc.path("hashSha256").asString()).isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PDF)));
            mvc.perform(get("/api/documentos/"+doc.path("id").asLong()+"/download").header("Authorization","Bearer "+login("persona@example.invalid")))
                .andExpect(status().isOk()).andExpect(content().bytes(PDF));
        }
        var recuperada=json.readTree(mvc.perform(get(recepcion()+"/"+clave).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(recuperada).isEqualTo(dto);
        mvc.perform(get(base()).header("Authorization","Bearer "+login("persona@example.invalid")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.respuesta.id").value(respuestaId))
            .andExpect(jsonPath("$.respuesta.documentosMetadata.length()").value(2));
    }
    @ParameterizedTest @ValueSource(strings={"ENTREGA_TOTAL","ENTREGA_PARCIAL","DENEGACION_TOTAL"})
    void adjuntosSiguenOpcionales(String tipo) throws Exception {
        mvc.perform(envio(UUID.randomUUID().toString(),tipo)).andExpect(status().isOk()).andExpect(jsonPath("$.documentos").isEmpty());
        assertThat(archivos()).isZero();assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
    }
    @Test void reintentoIdenticoRecuperaMismaRecepcionYHuellaIncompatibleNoDuplica() throws Exception {
        String clave=UUID.randomUUID().toString();var original=json.readTree(mvc.perform(envio(clave,"ENTREGA_PARCIAL",pdf("a.pdf")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var repetida=json.readTree(mvc.perform(envio(clave,"ENTREGA_PARCIAL",pdf("a.pdf")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());assertThat(repetida).isEqualTo(original);
        for(var incompatible:List.of(envio(clave,"DENEGACION_TOTAL",pdf("a.pdf")),envio(UUID.randomUUID().toString(),"ENTREGA_PARCIAL",pdf("a.pdf")),
                envio(clave,"ENTREGA_PARCIAL",pdf("otro-nombre.pdf")),envio(clave,"ENTREGA_PARCIAL"),
                envio(clave,"ENTREGA_PARCIAL",new MockMultipartFile("archivos","a.pdf","application/pdf","%PDF-1.4\nOtros bytes\n%%EOF".getBytes(StandardCharsets.UTF_8)))))
            mvc.perform(incompatible).andExpect(status().isConflict());
        assertThat(archivos()).isEqualTo(1);assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select count(*) from recepciones_respuesta_saip",Long.class)).isEqualTo(1L);
    }

    @Test void conservaTextoDelFuncionarioAlRegistrarYRecuperarLaRespuesta() throws Exception {
        String clave = UUID.randomUUID().toString();
        String texto = "Descripción escrita por el funcionario.\n\nFormato de entrega: digital\nPlazo estimado: 5 días hábiles";
        mvc.perform(multipart(recepcion()).param("claveOperacion", clave).param("tipoRespuesta", "ENTREGA_TOTAL")
                .param("contenido", texto).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.respuesta.contenido").value(texto));
        assertThat(jdbc.queryForObject("select contenido from respuestas where id_solicitud=?", String.class, solicitudId))
                .isEqualTo(texto);
        mvc.perform(get(recepcion() + "/" + clave).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.respuesta.contenido").value(texto));
        mvc.perform(get(base()).header("Authorization", "Bearer " + login("persona@example.invalid")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.respuesta.contenido").value(texto));
    }
    @Test void falloFisicoDuranteSegundoArchivoCompensaElPrimeroYRevierteEstado() throws Exception {
        AtomicInteger aperturas=new AtomicInteger();Path guardado=LOCAL.resolveSibling(LOCAL.getFileName()+"-respaldo");
        var fallo=new MockMultipartFile("archivos","segundo.pdf","application/pdf",PDF){
            @Override public InputStream getInputStream() throws IOException {
                InputStream in=super.getInputStream();
                if(aperturas.incrementAndGet()!=2)return in;
                Files.move(LOCAL,guardado);Files.createFile(LOCAL);
                return new FilterInputStream(in){@Override public void close() throws IOException{
                    try{super.close();}finally{Files.delete(LOCAL);Files.move(guardado,LOCAL);}
                }};
            }
        };
        String clave=UUID.randomUUID().toString();
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("primero.pdf"),fallo)).andExpect(status().isInternalServerError());sinEfectos();
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("primero.pdf"),pdf("segundo.pdf"))).andExpect(status().isOk());
        assertThat(archivos()).isEqualTo(2);
    }
    @Test void falloPostSubidaEnPostgresCompensaTodosLosObjetos() throws Exception {
        jdbc.execute("CREATE FUNCTION respuesta_rechazada() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo sintético' USING ERRCODE='23514'; END $$");
        jdbc.execute("CREATE TRIGGER respuesta_rechazada BEFORE INSERT ON recepciones_respuesta_saip FOR EACH ROW EXECUTE FUNCTION respuesta_rechazada()");
        String clave=UUID.randomUUID().toString();
        try{mvc.perform(envio(clave,"ENTREGA_PARCIAL",pdf("a.pdf"),pdf("b.pdf"))).andExpect(status().isConflict());sinEfectos();}
        finally{jdbc.execute("DROP TRIGGER respuesta_rechazada ON recepciones_respuesta_saip");jdbc.execute("DROP FUNCTION respuesta_rechazada()");}
        mvc.perform(envio(clave,"ENTREGA_PARCIAL",pdf("a.pdf"),pdf("b.pdf"))).andExpect(status().isOk());assertThat(archivos()).isEqualTo(2);
    }
    @Test void confirmacionPerdidaDespuesDelCommitSeRecuperaSinReescritura() throws Exception {
        String clave=UUID.randomUUID().toString();
        assertThatThrownBy(()->mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf")).header("X-Sintetico-Descartar","true"))).isInstanceOf(IOException.class);
        assertThat(estado()).isEqualTo("RESPONDIDA");
        var dto=json.readTree(mvc.perform(get(recepcion()+"/"+clave).header("Authorization","Bearer "+token))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(dto.path("id").asLong()));
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);assertThat(archivos()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"persona@example.invalid","otra@example.invalid","ajeno@example.invalid"})
    void actorAjenoNoRegistraNiRecuperaDocumentos(String email) throws Exception {
        String clave=UUID.randomUUID().toString();String ajeno=login(email);
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf")).with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer "+ajeno);return r;})).andExpect(status().isForbidden());sinEfectos();
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk());
        mvc.perform(get(recepcion()+"/"+clave).with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer "+ajeno);return r;})).andExpect(status().isForbidden());
        if(email.equals("otra@example.invalid"))mvc.perform(get("/api/documentos/1/download").with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer "+ajeno);return r;})).andExpect(status().isForbidden());
    }
    @Test void otroFuncionarioDeLaMismaEntidadNoReutilizaLaOperacion() throws Exception {
        String clave=UUID.randomUUID().toString();mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk());
        String colega=login("colega@example.invalid");
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf")).with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer "+colega);return r;})).andExpect(status().isForbidden());
        mvc.perform(get(recepcion()+"/"+clave).with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer "+colega);return r;})).andExpect(status().isForbidden());assertThat(archivos()).isEqualTo(1);
    }
    @Test void solicitudConObservacionPendienteNoRecibeRespuestaNiArchivos() throws Exception {
        observar();mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("PENDIENTE_INFORMACION");assertThat(archivos()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isZero();
    }
    @Test void contratoYFlywayConValidacionCompleta() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();assertThat(flyway.info().pending()).isEmpty();
        assertThat(Arrays.stream(flyway.info().applied()).map(i->i.getVersion().toString())).containsExactly("1","2","3","4","5","6","7","8","9","10","11","12");
        String dir=System.getenv("RESPUESTA_POSTGRES_ARTIFACTS");if(dir==null)return;
        var res=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(res.statusCode()).isEqualTo(200);Files.writeString(Path.of(dir,"openapi-respuesta.json"),res.body());
        JsonNode contrato=json.readTree(res.body());
        String ruta="/api/respuestas/solicitud/{solicitudId}/recepciones";
        assertThat(contrato.path("paths").path(ruta).path("post").path("requestBody").path("content").has("multipart/form-data")).isTrue();
        assertThat(contrato.path("paths").path(ruta).path("post").path("requestBody").path("required").asBoolean()).isTrue();
        assertThat(contrato.path("paths").path(ruta+"/{claveOperacion}").has("get")).isTrue();
        assertThat(contrato.path("components").path("schemas").path("RespuestaSaipRecepcionDTO").path("required").size()).isEqualTo(6);
        assertThat(contrato.path("components").path("schemas").path("RegistrarRespuestaSaipRequest").path("required").toString()).doesNotContain("archivos");
        assertThat(contrato.path("security").toString()).contains("bearerAuth");
        Files.writeString(Path.of(dir,"flyway-respuesta.json"),json.writeValueAsString(jdbc.queryForList("select version,script,checksum,success from flyway_schema_history order by installed_rank")));
    }
    @Test void concurrenciaIdenticaUnaRecepcionUnaRespuestaUnManifiesto() throws Exception {
        String clave=UUID.randomUUID().toString();
        var resultados=concurrentes(
            ()->mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(),
            ()->mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(json.readTree(resultados.get(0))).isEqualTo(json.readTree(resultados.get(1)));
        for(String tabla:List.of("respuestas","documentos","recepciones_respuesta_saip","recepcion_respuesta_saip_documentos"))
            assertThat(jdbc.queryForObject("select count(*) from "+tabla,Long.class)).as(tabla).isEqualTo(1L);
        assertThat(archivos()).isEqualTo(1);
    }
    @Test void concurrenciaIncompatibleNoDuplicaNiDejaArchivosDeLaPerdedora() throws Exception {
        var resultados=concurrentes(
            ()->mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf"))).andReturn().getResponse().getStatus(),
            ()->mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_PARCIAL",pdf("b.pdf"))).andReturn().getResponse().getStatus());
        assertThat(resultados).containsExactlyInAnyOrder(200,409);
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isEqualTo(1L);assertThat(archivos()).isEqualTo(1);
    }
    @Test void observacionYRecepcionConcurrentesNoProducenActuacionesIncompatibles() throws Exception {
        var resultados=concurrentes(
            ()->mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf"))).andReturn().getResponse().getStatus(),
            ()->mvc.perform(post(base()+"/observaciones").header("Authorization","Bearer "+token)
                .contentType("application/json").content("{\"motivoObservacion\":\"Precisar periodo solicitado\"}")).andReturn().getResponse().getStatus());
        assertThat(resultados.stream().filter(c->c==200||c==201).count()).isEqualTo(1);
        assertThat(resultados).allMatch(c->c==200||c==201||c==409||c==422);
        assertThat(jdbc.queryForObject("select (select count(*) from respuestas)+(select count(*) from observaciones_solicitud)",Long.class)).isEqualTo(1L);
        long cantidad=jdbc.queryForObject("select count(*) from respuestas",Long.class);assertThat(archivos()).isEqualTo(cantidad);
        assertThat(jdbc.queryForObject("select count(*) from recepciones_respuesta_saip",Long.class)).isEqualTo(cantidad);
    }
    @Test void claveDelActorNoSeReutilizaEnOtraSolicitud() throws Exception {
        String clave=UUID.randomUUID().toString();mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk());
        String body=json.writeValueAsString(Map.of("ciudadanoId",ciudadanoId,"entidadId",entidadId,"asunto","Otro recurso sintético", "descripcion","Solicitud diferente", "consentimientoDatosPersonales",true,"canalNotificacion","PLATAFORMA"));
        long nuevo=json.readTree(mvc.perform(post("/api/solicitudes").header("Authorization","Bearer "+login("persona@example.invalid"))
            .contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        solicitudId=nuevo; mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from respuestas where id_solicitud=?",Long.class,nuevo)).isZero();assertThat(archivos()).isEqualTo(1);
    }
    @Test void archivoAceptadoAusenteNoSeConfundeConRecepcionInexistente() throws Exception {
        String clave=UUID.randomUUID().toString();mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isOk());
        try(var paths=Files.walk(LOCAL)){for(Path p:paths.filter(Files::isRegularFile).toList())Files.delete(p);}
        mvc.perform(get(recepcion()+"/"+clave).header("Authorization","Bearer "+token)).andExpect(status().isInternalServerError());
        mvc.perform(envio(clave,"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isInternalServerError());
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isEqualTo(1L);assertThat(archivos()).isZero();
    }
    @ParameterizedTest @ValueSource(strings={"CONCLUIDA","RESPONDIDA","DENEGADA"})
    void conservaDefensasDeEstadoSinEscriturasParciales(String estado) throws Exception {
        jdbc.update("update solicitudes set estado=? where id_solicitud=?",estado,solicitudId);
        mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf"))).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo(estado);assertThat(archivos()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isZero();
    }
    @Test void bearerAusenteManipuladoYFuncionarioSuplantadoNoCreanRespuesta() throws Exception {
        mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf")).with(r->{r.removeHeader("Authorization");return r;})).andExpect(status().isUnauthorized());
        mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf")).with(r->{r.removeHeader("Authorization");r.addHeader("Authorization","Bearer manipulado");return r;})).andExpect(status().isUnauthorized());
        mvc.perform(envio(UUID.randomUUID().toString(),"ENTREGA_TOTAL",pdf("a.pdf")).param("funcionarioId",String.valueOf(funcionarioId+1))).andExpect(status().isForbidden());
        sinEfectos();
    }

    <T> List<T> concurrentes(Callable<T> uno,Callable<T> dos) throws Exception {
        try(var executor=Executors.newFixedThreadPool(3)) {
            CountDownLatch retenido=new CountDownLatch(1), liberar=new CountDownLatch(1);
            var holder=executor.submit(()->new TransactionTemplate(manager).execute(tx->{
                jdbc.queryForObject("select id_solicitud from solicitudes where id_solicitud=? for update",Long.class,solicitudId);
                retenido.countDown();try {if(!liberar.await(20,TimeUnit.SECONDS)) throw new IllegalStateException("Timeout sintético");}
                catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}return null;
            }));
            assertThat(retenido.await(10,TimeUnit.SECONDS)).isTrue();
            var a=executor.submit(uno);var b=executor.submit(dos);
            try {
                long fin=System.nanoTime()+TimeUnit.SECONDS.toNanos(12);
                long esperando=0;
                while(System.nanoTime()<fin) {
                    esperando=jdbc.queryForObject("select count(distinct pid) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%solicitudes%'",Long.class);
                    if(esperando>=2) break;Thread.sleep(20);
                }
                assertThat(esperando).as("conexiones independientes esperando el bloqueo SAIP").isGreaterThanOrEqualTo(2);
            } finally {liberar.countDown();}
            holder.get(15,TimeUnit.SECONDS);return List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));
        }
    }
    @TestConfiguration static class DescartarConfirmacion {
        @Bean Filter descartar(){return (request,response,chain)->{
            chain.doFilter(request,response);
            if("true".equals(((HttpServletRequest)request).getHeader("X-Sintetico-Descartar")))throw new IOException("Confirmación descartada después del commit (solo prueba)");
        };}
    }
}
