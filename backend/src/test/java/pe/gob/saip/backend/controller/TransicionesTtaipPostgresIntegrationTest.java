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
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.service.SubsanacionTtaipService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real JWT login, security, JPA, transactions and PostgreSQL. External notifications use MOCK. */
@EnabledIfEnvironmentVariable(named = "RUN_R3_POSTGRES_TESTS", matches = "true")
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
class TransicionesTtaipPostgresIntegrationTest {
    private static final Path ROOT = temporal();
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
    @Autowired NotificacionTtaipRepository notificaciones;
    @Autowired SubsanacionTtaipService subsanaciones;
    @Autowired DocumentoRepository documentos;
    @Autowired Flyway flyway;
    @LocalServerPort int port;
    long apelacionId, expedienteId;

    @DynamicPropertySource static void propiedades(DynamicPropertyRegistry r) {
        String url = System.getenv("TTAIP_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base temporal propia de pruebas en loopback");
        r.add("spring.datasource.url", () -> url);
        r.add("spring.datasource.username", () -> "yaiku_e11_test");
        r.add("spring.datasource.password", () -> "");
        r.add("app.storage.local.base-path", () -> ROOT.toString());
    }
    static Path temporal() {
        try { return Files.createTempDirectory("yaiku-r3-local-"); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    @BeforeEach void preparar() {
        jdbc.execute("TRUNCATE usuarios, entidades, salas_ttaip RESTART IDENTITY CASCADE");
        String hash = encoder.encode("Sintetico-2026!");
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            Usuario tribunal = new Usuario(); tribunal.setEmail("tribunal@example.invalid");
            tribunal.setPassword(hash); tribunal.setTipoUsuario(Usuario.TipoUsuario.TTAIP); usuarios.saveAndFlush(tribunal);
            Ciudadano c = ciudadano("persona@example.invalid", "00000001", hash);
            ciudadano("otra@example.invalid", "00000002", hash);
            Entidad e = new Entidad(); e.setNombre("Entidad sintética"); e.setAcronimo("SINT"); entidades.saveAndFlush(e);
            Entidad otra = new Entidad(); otra.setNombre("Otra entidad sintética"); otra.setAcronimo("OTRA"); entidades.saveAndFlush(otra);
            funcionario("funcionario@example.invalid", hash, e); funcionario("ajeno@example.invalid", hash, otra);
            SalaTtaip s = new SalaTtaip(); s.setNombre("Sala sintética");
            s.setPeriodoInicio(LocalDate.of(2025,1,1)); s.setPeriodoFin(LocalDate.of(2035,1,1)); salas.saveAndFlush(s);
            Apelacion ap = new Apelacion(); ap.setCiudadano(c); ap.setEntidadApelada(e);
            ap.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA); ap.setFundamentos("Fundamentos originales sintéticos");
            ap.setExpediente("00001-2026-JUS/TTAIP"); ap.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1);
            apelaciones.saveAndFlush(ap); apelacionId = ap.getId();
            ExpedienteTtaip exp = new ExpedienteTtaip(); exp.setApelacion(ap); exp.setSala(s);
            exp.setNumeroExpediente(ap.getExpediente()); exp.setEstado(ap.getEstado()); expedientes.saveAndFlush(exp);
            expedienteId = exp.getId();
        });
    }
    Ciudadano ciudadano(String email, String dni, String hash) {
        Ciudadano c = new Ciudadano(); c.setEmail(email); c.setDni(dni); c.setNombreCompleto("Persona sintética");
        c.setPassword(hash); c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO); return ciudadanos.saveAndFlush(c);
    }
    void funcionario(String email, String hash, Entidad e) {
        Funcionario f = new Funcionario(); f.setEmail(email); f.setPassword(hash); f.setNombreCompleto("Funcionario sintético");
        f.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO); f.setEntidad(e); funcionarios.saveAndFlush(f);
    }
    String login(String email) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("identificador", email, "password", "Sintetico-2026!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("token").asString();
    }
    String tribunal() throws Exception { return login("tribunal@example.invalid"); }
    String base() { return "/api/apelaciones/"+apelacionId; }
    String notificar() { return "/api/ttaip/"+apelacionId+"/notificar-segunda-calificacion"; }
    ResultActions comando(String operacion, String token) throws Exception {
        return mvc.perform(post("/api/ttaip/"+operacion.replace("{id}", Long.toString(apelacionId)))
            .header("Authorization", "Bearer "+token).contentType("application/json")
            .content("{\"fundamentos\":\"Fundamento aportado por el operador sintético\",\"observaciones\":\"Observación sintética\"}"));
    }
    String estado() { return jdbc.queryForObject("select estado from apelaciones where id_apelacion=?", String.class, apelacionId); }

    String consultaRecepcion(long requerimientoId) {
        return "/api/ttaip/expedientes/"+expedienteId+"/requerimientos/"+requerimientoId+"/subsanacion/recepcion";
    }
    long requerimientoId() {
        return resoluciones.findByApelacion_Id(apelacionId).stream()
            .filter(r -> r.getTipoResolucion()==Resolucion.TipoResolucion.PRIMERA_CALIFICACION).findFirst().orElseThrow().getId();
    }
    JsonNode recibirParaConsulta(boolean archivos) throws Exception {
        comando("calificacion/{id}/subsanar",tribunal()).andExpect(status().isOk());
        var request=multipart("/api/apelaciones/"+apelacionId+"/subsanacion/"+requerimientoId()+"/recepcion")
            .param("claveOperacion",UUID.randomUUID().toString()).param("fundamentosAdicionales","Correcciones sintéticas para el requerimiento");
        if(archivos) {
            request.file(new org.springframework.mock.web.MockMultipartFile("archivos","uno.pdf","application/pdf","%PDF-1.4\nSintetico uno\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
            request.file(new org.springframework.mock.web.MockMultipartFile("archivos","dos.pdf","application/pdf","%PDF-1.4\nSintetico dos\n%%EOF".getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        return json.readTree(mvc.perform(request.header("Authorization","Bearer "+login("persona@example.invalid")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    Map<String,String> estadoPersistido() {
        Map<String,String> snapshot=new TreeMap<>();
        for(String table:List.of("apelaciones","expedientes_ttaip","resoluciones","recepciones_subsanacion_ttaip",
                "recepcion_subsanacion_ttaip_documentos","documentos","historial_ttaip","notificaciones_ttaip","cedulas_notificacion","inicios_plazo_subsanacion_ttaip"))
            snapshot.put(table,jdbc.queryForObject("select coalesce(md5(string_agg(row_to_json(t)::text,'' order by row_to_json(t)::text)),'empty') from "+table+" t",String.class));
        return snapshot;
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void consultaInstitucionalSinClaveDevuelveRecepcionConOSinAdjuntosSinMutar(boolean archivos) throws Exception {
        JsonNode citizen=recibirParaConsulta(archivos); long req=requerimientoId(); String t=tribunal();
        var before=estadoPersistido();
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+consultaRecepcion(req)))
            .header("Authorization","Bearer "+t).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode receipt=json.readTree(response.body());
        assertThat(receipt.path("estado").asString()).isEqualTo("RECIBIDA");
        assertThat(receipt.path("recepcionId").asLong()).isEqualTo(citizen.path("id").asLong());
        assertThat(receipt.path("expedienteTtaipId").asLong()).isEqualTo(expedienteId);
        assertThat(receipt.path("apelacionId").asLong()).isEqualTo(apelacionId);
        assertThat(receipt.path("requerimientoId").asLong()).isEqualTo(req);
        assertThat(receipt.path("documentos").size()).isEqualTo(archivos?2:0);
        assertThat(response.body()).doesNotContain("claveOperacion","huellaSolicitud","storageKey",citizen.path("claveOperacion").asString());
        mvc.perform(get(consultaRecepcion(req)).header("Authorization","Bearer "+t)).andExpect(status().isOk());
        assertThat(estadoPersistido()).isEqualTo(before);
        if (archivos) for (JsonNode doc:receipt.path("documentos")) {
            long id=doc.path("id").asLong();
            assertThat(doc.path("apelacionId").asLong()).isEqualTo(apelacionId);
            byte[] expected=("%PDF-1.4\nSintetico "+(doc.path("nombreOriginal").asString().equals("uno.pdf")?"uno":"dos")+"\n%%EOF")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
            var download=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/documentos/"+id+"/download"))
                .header("Authorization","Bearer "+t).GET().build(),HttpResponse.BodyHandlers.ofByteArray());
            assertThat(download.statusCode()).isEqualTo(200); assertThat(download.body()).isEqualTo(expected);
            assertThat(doc.path("hashSha256").asString()).isEqualTo(HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(expected)));
            mvc.perform(get("/api/documentos/"+id+"/download").header("Authorization","Bearer "+login("otra@example.invalid"))).andExpect(status().isForbidden());
        }
        String recovery="/api/apelaciones/"+apelacionId+"/subsanacion/"+req+"/recepcion/"+citizen.path("claveOperacion").asString();
        mvc.perform(get(recovery).header("Authorization","Bearer "+t)).andExpect(status().isForbidden());
        mvc.perform(get(recovery).header("Authorization","Bearer "+login("otra@example.invalid"))).andExpect(status().isForbidden());
        mvc.perform(get(recovery).header("Authorization","Bearer "+login("persona@example.invalid"))).andExpect(status().isOk());
    }

    @Test void consultaInstitucionalDistingueAusenciaDeRecursosInexistentes() throws Exception {
        String t=tribunal(); comando("calificacion/{id}/subsanar",t).andExpect(status().isOk()); long req=requerimientoId(); var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(req)).header("Authorization","Bearer "+t)).andExpect(status().isOk())
            .andExpect(jsonPath("$.estado").value("AUSENTE")).andExpect(jsonPath("$.recepcionId").isEmpty())
            .andExpect(jsonPath("$.documentos").isEmpty());
        mvc.perform(get(consultaRecepcion(req+9999)).header("Authorization","Bearer "+t)).andExpect(status().isNotFound());
        mvc.perform(get(consultaRecepcion(req).replace("/expedientes/"+expedienteId+"/","/expedientes/999999/"))
            .header("Authorization","Bearer "+t)).andExpect(status().isNotFound());
        assertThat(estadoPersistido()).isEqualTo(before);
    }

    @ParameterizedTest @ValueSource(strings={"persona@example.invalid","otra@example.invalid","funcionario@example.invalid","ajeno@example.invalid"})
    void consultaInstitucionalNoAmpliaPermisosAActoresNoTribunal(String email) throws Exception {
        recibirParaConsulta(false); var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(requerimientoId())).header("Authorization","Bearer "+login(email))).andExpect(status().isForbidden());
        mvc.perform(get(consultaRecepcion(requerimientoId()))).andExpect(status().isUnauthorized());
        assertThat(estadoPersistido()).isEqualTo(before);
    }

    @Test void consultaInstitucionalAdministradorPermitidoSinClaveCiudadana() throws Exception {
        JsonNode recibida=recibirParaConsulta(false);
        Usuario admin=new Usuario(); admin.setEmail("admin@example.invalid"); admin.setPassword(encoder.encode("Sintetico-2026!"));
        admin.setTipoUsuario(Usuario.TipoUsuario.ADMINISTRADOR); usuarios.saveAndFlush(admin);
        var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(requerimientoId())).header("Authorization","Bearer "+login(admin.getEmail())))
            .andExpect(status().isOk()).andExpect(jsonPath("$.recepcionId").value(recibida.path("id").asLong()));
        assertThat(estadoPersistido()).isEqualTo(before);
    }

    @Test void consultaInstitucionalRechazaRelacionCruzadaYActuacionQueNoEsRequerimiento() throws Exception {
        recibirParaConsulta(false); String t=tribunal(); long req=requerimientoId();
        long otro=new TransactionTemplate(manager).execute(tx -> {
            Apelacion original=apelaciones.findById(apelacionId).orElseThrow();
            Apelacion ap=new Apelacion(); ap.setCiudadano(original.getCiudadano()); ap.setEntidadApelada(original.getEntidadApelada());
            ap.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA); ap.setFundamentos("Otro caso sintético");
            ap.setExpediente("00002-2026-JUS/TTAIP"); ap.setEstado(Apelacion.EstadoApelacion.EN_CALIFICACION_1); apelaciones.saveAndFlush(ap);
            ExpedienteTtaip exp=new ExpedienteTtaip(); exp.setApelacion(ap); exp.setSala(salas.findAll().getFirst());
            exp.setNumeroExpediente(ap.getExpediente()); exp.setEstado(ap.getEstado()); return expedientes.saveAndFlush(exp).getId();
        });
        var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(req).replace("/expedientes/"+expedienteId+"/","/expedientes/"+otro+"/"))
            .header("Authorization","Bearer "+t)).andExpect(status().isNotFound());
        assertThat(estadoPersistido()).isEqualTo(before);
        comando("calificacion/{id}/admitir",t).andExpect(status().isOk());
        long second=resoluciones.findByApelacion_Id(apelacionId).stream().filter(r -> r.getTipoResolucion()==Resolucion.TipoResolucion.SEGUNDA_CALIFICACION).findFirst().orElseThrow().getId();
        before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(second)).header("Authorization","Bearer "+t)).andExpect(status().isConflict());
        assertThat(estadoPersistido()).isEqualTo(before);
    }

    @Test void consultaInstitucionalArchivoNoDisponibleNoEsAusenciaNiMutaLaRecepcion() throws Exception {
        JsonNode r=recibirParaConsulta(true); String t=tribunal(); long id=r.path("documentos").get(0).path("id").asLong();
        Documento doc=documentos.findById(id).orElseThrow(); Files.delete(ROOT.resolve(doc.getStorageKey()));
        var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(requerimientoId())).header("Authorization","Bearer "+t)).andExpect(status().isInternalServerError());
        assertThat(estadoPersistido()).isEqualTo(before);
    }

    @Test void consultaInstitucionalRechazaDocumentoConAsociacionIncompatibleSinMutacion() throws Exception {
        JsonNode r=recibirParaConsulta(true); long id=r.path("documentos").get(0).path("id").asLong();
        jdbc.update("update documentos set id_resolucion=? where id_documento=?",requerimientoId(),id);
        var before=estadoPersistido();
        mvc.perform(get(consultaRecepcion(requerimientoId())).header("Authorization","Bearer "+tribunal())).andExpect(status().isConflict());
        assertThat(estadoPersistido()).isEqualTo(before);
    }
    void segundaCalificacion(String token) throws Exception {
        comando("calificacion/{id}/subsanar",token).andExpect(status().isOk());
        mvc.perform(post(base()+"/subsanacion").header("Authorization","Bearer "+login("persona@example.invalid"))
            .contentType("application/json").content("{\"fundamentosAdicionales\":\"Subsanación real sintética\"}"))
            .andExpect(status().isOk());
        comando("calificacion/{id}/admitir",token).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("NOTIFICACION_SEGUNDA_CALIFICACION");
    }
    void subsanacionVencida(String token) throws Exception {
        comando("calificacion/{id}/subsanar",token).andExpect(status().isOk());
        long notificacion=new TransactionTemplate(manager).execute(tx -> {
            Resolucion r=resoluciones.findByApelacion_Id(apelacionId).getFirst();
            r.setFechaResolucion(LocalDateTime.now().minusDays(12));
            return notificaciones.findByExpediente_IdExpedienteTtaipOrderByFechaNotificacionAsc(expedienteId).getFirst().getId();
        });
        mvc.perform(post("/api/ttaip/expedientes/"+expedienteId+"/notificaciones/"+notificacion+"/validacion-manual")
            .header("Authorization","Bearer "+token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("responsableValidacion","Operador sintético",
                "observacionValidacion","Cargo de entrega sintético comprobado","referenciaEvidencia","CARGO-SINT",
                "fechaEficacia",LocalDateTime.now().minusDays(10).toString())))).andExpect(status().isOk());
    }
    List<Long> registros() { return List.of(cuenta("resoluciones"),cuenta("cedulas_notificacion"),cuenta("notificaciones_ttaip"),cuenta("historial_ttaip"),cuenta("documentos")); }
    long cuenta(String tabla) { return jdbc.queryForObject("select count(*) from "+tabla, Long.class); }

    List<Long> notificacionesDe(Resolucion.TipoResolucion tipo) {
        return new TransactionTemplate(manager).execute(tx -> notificaciones
            .findByExpediente_IdExpedienteTtaipOrderByFechaNotificacionAsc(expedienteId).stream()
            .filter(n -> n.getCedula().getResolucion().getTipoResolucion()==tipo).map(NotificacionTtaip::getId).toList());
    }
    void validarNotificacion(long id, String token) throws Exception {
        mvc.perform(post("/api/ttaip/expedientes/"+expedienteId+"/notificaciones/"+id+"/validacion-manual")
            .header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"responsableValidacion\":\"Operador sintético\",\"observacionValidacion\":\"Cargo comprobado\",\"referenciaEvidencia\":\"CARGO-SINT\"}"))
            .andExpect(status().isOk());
    }
    void acuse(long id, String token) throws Exception {
        String url="/api/ttaip/expedientes/"+expedienteId+"/notificaciones/"+id;
        mvc.perform(post(url+"/constancia-envio").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"medioNotificacion\":\"CORREO_ELECTRONICO\",\"constanciaEnvio\":\"Constancia sintética\",\"responsable\":\"Operador sintético\"}"))
            .andExpect(status().isOk());
        mvc.perform(post(url+"/acuse-automatico").header("Authorization","Bearer "+token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("estadoAcuse","ENTREGADO","acuseAutomatico","Cargo de recepción sintético",
                "fechaAcuse",LocalDateTime.now().toString(),"referenciaEvidencia","ACUSE-SINT"))))
            .andExpect(status().isOk());
    }
    long requerirDescargos(String token) throws Exception {
        String r=mvc.perform(post("/api/ttaip/expedientes/"+expedienteId+"/descargos/requerir")
            .header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"responsableTtaip\":\"Operador sintético\",\"observacion\":\"Requerimiento sintético\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(r).path("id").asLong();
    }
    void completarDescargos(String token) throws Exception {
        long id=requerirDescargos(token);
        String url="/api/ttaip/expedientes/"+expedienteId+"/descargos/"+id+"/presentar";
        String body="{\"resumenDescargo\":\"Descargo sintético\",\"referenciaDocumento\":\"REF-SINT\",\"responsableEntidad\":\"Funcionario sintético\"}";
        mvc.perform(post(url).header("Authorization","Bearer "+login("ajeno@example.invalid"))
            .contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(url).header("Authorization","Bearer "+login("funcionario@example.invalid"))
            .contentType("application/json").content(body)).andExpect(status().isOk());
    }

    @ParameterizedTest @ValueSource(strings={"EN_SUBSANACION","EN_CALIFICACION_2","NOTIFICACION_SEGUNDA_CALIFICACION","EN_RESOLUCION","RESUELTO_FUNDADO"})
    void patchGenericoNoOmiteActuaciones(String destino) throws Exception {
        String token=tribunal(); var antes=registros();
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token)
            .contentType("application/json").content(json.writeValueAsString(Map.of("estado",destino))))
            .andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("EN_CALIFICACION_1"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void putNoPermiteElMismoBypassNiActualizaFundamentosParcialmente() throws Exception {
        var antes=registros();
        mvc.perform(put(base()).header("Authorization","Bearer "+tribunal()).contentType("application/json")
            .content("{\"estado\":\"RESUELTO_FUNDADO\",\"fundamentos\":\"No debe persistir\"}"))
            .andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("EN_CALIFICACION_1"); assertThat(registros()).isEqualTo(antes);
        assertThat(jdbc.queryForObject("select fundamentos from apelaciones where id_apelacion=?",String.class,apelacionId)).contains("originales");
    }
    @Test void notificarNoConviertePrimeraCalificacionEnResolucion() throws Exception {
        var antes=registros();
        mvc.perform(post(notificar()).header("Authorization","Bearer "+tribunal())).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("EN_CALIFICACION_1"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void comandoFinalNoResuelveSinAdmision() throws Exception {
        var antes=registros(); comando("resolucion/{id}/fundado",tribunal()).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("EN_CALIFICACION_1"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void requerimientoRealEsAtomicoYElReintentoNoDuplica() throws Exception {
        String token=tribunal(); comando("calificacion/{id}/subsanar",token).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("EN_SUBSANACION");
        assertThat(cuenta("resoluciones")).isEqualTo(1); assertThat(cuenta("cedulas_notificacion")).isEqualTo(1);
        var antes=registros(); comando("calificacion/{id}/subsanar",token).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
    }
    @ParameterizedTest @ValueSource(strings={"PENDIENTE","FALLIDA","OBSERVADA"})
    void segundaNoAvanzaConNotificacionesNoEficaces(String estadoNotificacion) throws Exception {
        String token=tribunal(); segundaCalificacion(token);
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            for (NotificacionTtaip n : notificaciones.findByExpediente_IdExpedienteTtaipOrderByFechaNotificacionAsc(expedienteId)) {
                n.setEstado(estadoNotificacion); n.setEstadoAcuse("PENDIENTE");
            }
        });
        var antes=registros();
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("NOTIFICACION_SEGUNDA_CALIFICACION"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void rechazoPorVencimientoNoCierraSinResolucionNiDejaCambiosParciales() throws Exception {
        String token=tribunal(); subsanacionVencida(token); var antes=registros();
        mvc.perform(post(base()+"/subsanacion").header("Authorization","Bearer "+login("persona@example.invalid"))
            .contentType("application/json").content("{\"fundamentosAdicionales\":\"Presentación tardía sintética\"}"))
            .andExpect(status().isUnprocessableEntity());
        assertThat(estado()).isEqualTo("EN_SUBSANACION"); assertThat(registros()).isEqualTo(antes);
        assertThat(cuenta("recepciones_subsanacion_ttaip")).isZero();
    }
    @Test void tareaDeVencimientosNoInventaResolucionDeNoPresentado() throws Exception {
        subsanacionVencida(tribunal()); var antes=registros();
        assertThat(subsanaciones.procesarVencidas()).isEqualTo(1);
        assertThat(estado()).isEqualTo("EN_SUBSANACION"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void segundaExigeAmbosDestinatariosYConfirmaEstadoRecuperableSinDuplicar() throws Exception {
        String token=tribunal(); segundaCalificacion(token);
        var snapshot=estadoPersistido();
        mvc.perform(get(consultaRecepcion(requerimientoId())).header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.estado").value("RECIBIDA"));
        assertThat(estadoPersistido()).isEqualTo(snapshot);
        comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        // An explicit validation of the previous requirement is not evidence for the new admission.
        validarNotificacion(notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION).getFirst(),token);
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        var ids=notificacionesDe(Resolucion.TipoResolucion.SEGUNDA_CALIFICACION); assertThat(ids).hasSize(2);
        validarNotificacion(ids.getFirst(),token);
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        acuse(ids.getLast(),token);
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.estado").value("EN_RESOLUCION"));
        mvc.perform(get(base()).header("Authorization","Bearer "+token)).andExpect(status().isOk())
            .andExpect(jsonPath("$.estado").value("EN_RESOLUCION"));
        var despues=registros();
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isOk());
        assertThat(registros()).isEqualTo(despues);
        comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        completarDescargos(token);
        comando("resolucion/{id}/fundado",token).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("RESUELTO_FUNDADO");
        despues=registros(); comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(despues);
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"EN_CALIFICACION_1\"}")).andExpect(status().isConflict());
    }
    @Test void envioTecnicoNoEquivaleAValidacionNiAutorizaResolucionFinal() throws Exception {
        String token=tribunal(); comando("calificacion/{id}/admitir",token).andExpect(status().isOk());
        var antes=registros(); comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
        for(long id:notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION)) validarNotificacion(id,token);
        completarDescargos(token);
        comando("resolucion/{id}/fundado",token).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("RESUELTO_FUNDADO");
    }
    @Test void etiquetaValidadaSinActuacionRegistradaNoAcreditaEficacia() throws Exception {
        String token=tribunal(); segundaCalificacion(token);
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            for(long id:notificacionesDe(Resolucion.TipoResolucion.SEGUNDA_CALIFICACION)) {
                NotificacionTtaip n=notificaciones.findById(id).orElseThrow(); n.setEstado("VALIDADA");
                n.setValidadaManualmente(true); n.setFechaValidacionManual(LocalDateTime.now());
                n.setResponsableValidacion("Operador"); n.setObservacionValidacion("Sin actuación registrada");
            }
        });
        var antes=registros(); mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
    }
    @Test void reenvioTecnicoNoReutilizaUnAcuseAnteriorParaAcreditarSuResultado() throws Exception {
        String token=tribunal(); comando("calificacion/{id}/admitir",token).andExpect(status().isOk());
        for(long id:notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION)) acuse(id,token);
        completarDescargos(token);
        for(long id:notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION)) {
            mvc.perform(post("/api/ttaip/expedientes/"+expedienteId+"/notificaciones/"+id+"/enviar")
                .header("Authorization","Bearer "+token).contentType("application/json")
                .content("{\"asunto\":\"Envío sintético\",\"contenido\":\"Notificación sintética\"}"))
                .andExpect(status().isCreated());
        }
        var antes=registros(); comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
        for(long id:notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION)) validarNotificacion(id,token);
        comando("resolucion/{id}/fundado",token).andExpect(status().isOk());
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void resolucionFinalNoOmiteDescargosObligatorios(boolean requeridosPendientes) throws Exception {
        String token=tribunal(); comando("calificacion/{id}/admitir",token).andExpect(status().isOk());
        for(long id:notificacionesDe(Resolucion.TipoResolucion.PRIMERA_CALIFICACION)) validarNotificacion(id,token);
        if(requeridosPendientes) requerirDescargos(token);
        var antes=registros(); comando("resolucion/{id}/fundado",token).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("EN_RESOLUCION"); assertThat(registros()).isEqualTo(antes);
    }
    @Test void notificacionDeOtroExpedienteODestinatarioNoSatisfaceLaAdmision() throws Exception {
        String token=tribunal(); segundaCalificacion(token);
        var ids=notificacionesDe(Resolucion.TipoResolucion.SEGUNDA_CALIFICACION);
        for(long id:ids) validarNotificacion(id,token);
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            NotificacionTtaip n=notificaciones.findById(ids.getLast()).orElseThrow();
            n.setDestinatario(n.getDestinatario()==CedulaNotificacion.DestinatarioNotificacion.CIUDADANO
                ? CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA : CedulaNotificacion.DestinatarioNotificacion.CIUDADANO);
        });
        var antes=registros(); mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
        mvc.perform(post("/api/ttaip/expedientes/"+(expedienteId+999)+"/notificaciones/"+ids.getFirst()+"/validacion-manual")
            .header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"responsableValidacion\":\"Operador\",\"observacionValidacion\":\"Cargo\",\"referenciaEvidencia\":\"SINT\"}"))
            .andExpect(status().isNotFound());
    }
    @Test void vencimientoSeCierraSoloConElComandoYResolucionRegistrada() throws Exception {
        String token=tribunal(); subsanacionVencida(token);
        comando("calificacion/{id}/no-presentado",token).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("TENER_POR_NO_PRESENTADO"); assertThat(cuenta("resoluciones")).isEqualTo(2);
        var antes=registros(); comando("calificacion/{id}/no-presentado",token).andExpect(status().isConflict());
        assertThat(registros()).isEqualTo(antes);
    }
    @Test void datosSinCambioDeEstadoSonCompatiblesYEntradasInvalidasNoMutan() throws Exception {
        String token=tribunal(); var antes=registros();
        mvc.perform(put(base()).header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"EN_CALIFICACION_1\",\"fundamentos\":\"Texto actualizado\"}")).andExpect(status().isOk());
        assertThat(registros()).isEqualTo(antes);
        for(String body:List.of("{}","{\"estado\":\"inventado\"}"))
            mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json").content(body))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(patch("/api/apelaciones/99999999/estado").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"EN_RESOLUCION\"}")).andExpect(status().isNotFound());
        assertThat(estado()).isEqualTo("EN_CALIFICACION_1");
    }
    @Test void dosComandosHttpConcurrentesUsanConexionesIndependientesYUnaSolaActuacion() throws Exception {
        String token=tribunal(); Set<String> conexiones=new HashSet<>();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var pendientes=new ArrayList<Future<Integer>>();
            new TransactionTemplate(manager).executeWithoutResult(tx -> {
                jdbc.queryForObject("select id_apelacion from apelaciones where id_apelacion=? for update",Long.class,apelacionId);
                for(int i=0;i<2;i++) pendientes.add(pool.submit(() -> HttpClient.newHttpClient().send(
                    HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/ttaip/calificacion/"+apelacionId+"/subsanar"))
                        .header("Authorization","Bearer "+token).header("Content-Type","application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{\"fundamentos\":\"Actuación concurrente sintética\"}")).build(),
                    HttpResponse.BodyHandlers.discarding()).statusCode()));
                long limite=System.nanoTime()+TimeUnit.SECONDS.toNanos(15);
                while(conexiones.size()<2 && System.nanoTime()<limite) {
                    conexiones.addAll(jdbc.queryForList("select pid::text from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()",String.class));
                    try { Thread.sleep(50); } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
                }
                assertThat(conexiones).hasSize(2);
            });
            assertThat(List.of(pendientes.get(0).get(30,TimeUnit.SECONDS),pendientes.get(1).get(30,TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(200,409);
        }
        assertThat(cuenta("resoluciones")).isEqualTo(1); assertThat(cuenta("cedulas_notificacion")).isEqualTo(1);
        assertThat(estado()).isEqualTo("EN_SUBSANACION");
        String dir=System.getenv("TTAIP_POSTGRES_ARTIFACTS");
        if(dir!=null) Files.writeString(Path.of(dir,"concurrencia-r3.txt"),"Conexiones HTTP independientes bloqueadas en PostgreSQL: "+conexiones);
    }
    @ParameterizedTest @ValueSource(strings={"persona@example.invalid","otra@example.invalid","funcionario@example.invalid","ajeno@example.invalid"})
    void actoresSinRolNoPuedenUsarElBypassNiElComando(String email) throws Exception {
        String token=login(email); var antes=registros();
        mvc.perform(get(base()).header("Authorization","Bearer "+token))
            .andExpect(status().is(email.equals("persona@example.invalid") || email.equals("funcionario@example.invalid") ? 200 : 403));
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"EN_RESOLUCION\"}")).andExpect(status().isForbidden());
        mvc.perform(post(notificar()).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        assertThat(registros()).isEqualTo(antes);
    }
    @ParameterizedTest @ValueSource(strings={"EN_CALIFICACION_2","EN_RESOLUCION"})
    void etiquetaHistoricaSinActuacionesNoHabilitaComandos(String estadoSinActuaciones) throws Exception {
        jdbc.update("update apelaciones set estado=? where id_apelacion=?",estadoSinActuaciones,apelacionId);
        String token=tribunal(); var antes=registros();
        comando(estadoSinActuaciones.equals("EN_CALIFICACION_2") ? "calificacion/{id}/admitir" : "resolucion/{id}/fundado",token)
            .andExpect(status().isConflict());
        assertThat(estado()).isEqualTo(estadoSinActuaciones); assertThat(registros()).isEqualTo(antes);
    }
    @Test void flywayValidateYContratoCompletoDeLaInstanciaReal() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.info().pending()).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success=false",Long.class)).isZero();
        String dir=System.getenv("TTAIP_POSTGRES_ARTIFACTS");
        if(dir!=null) {
            Files.createDirectories(Path.of(dir));
            var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            Files.writeString(Path.of(dir,"openapi-r3.json"),response.body());
            Files.writeString(Path.of(dir,"flyway-r3.txt"),Arrays.toString(Arrays.stream(flyway.info().applied()).map(i->i.getVersion()+" "+i.getDescription()+" "+i.getChecksum()).toArray()));
        }
    }
}
