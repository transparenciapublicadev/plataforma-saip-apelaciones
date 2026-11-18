package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.file.*;
import java.util.*;
import java.net.URI;
import java.net.http.*;
import java.util.concurrent.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.repository.*;
import pe.gob.saip.backend.service.PlazoCalculadorService;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Opt-in own PostgreSQL, original Flyway, real JWT/security/JPA/LOCAL; external providers MOCK. */
@EnabledIfEnvironmentVariable(named="RUN_ALTA_APELACION_POSTGRES_TESTS", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "server.address=127.0.0.1", "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "springdoc.default-produces-media-type=application/json", "springdoc.default-consumes-media-type=application/json",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import(AltaApelacionRecepcionPostgresIntegrationTest.DescartarConfirmacion.class)
class AltaApelacionRecepcionPostgresIntegrationTest {
    private static final Path LOCAL=temporal();
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired UsuarioRepository usuarios;
    @Autowired EntidadRepository entidades;
    @Autowired DocumentoRepository documentos;
    @Autowired FuncionarioRepository funcionarios;
    @Autowired Flyway flyway;
    @Autowired PlazoCalculadorService calendario;
    @Autowired PlatformTransactionManager manager;
    @LocalServerPort int port;
    long ciudadanoId, entidadId;
    String token;

    @DynamicPropertySource static void propiedades(DynamicPropertyRegistry r) {
        String url=System.getenv("ALTA_APELACION_POSTGRES_URL");
        if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base propia temporal en loopback");
        r.add("spring.datasource.url",()->url); r.add("spring.datasource.username",()->"yaiku_e11_test");
        r.add("spring.datasource.password",()->""); r.add("app.storage.local.base-path",()->LOCAL.toString());
    }
    static Path temporal() {try{return Files.createTempDirectory("yaiku-alta-apelacion-");}catch(Exception e){throw new IllegalStateException(e);}}
    @BeforeEach void preparar() throws Exception {
        jdbc.execute("TRUNCATE usuarios, entidades RESTART IDENTITY CASCADE");
        try(var p=Files.walk(LOCAL)){for(Path f:p.filter(Files::isRegularFile).toList())Files.delete(f);}
        String hash=encoder.encode("Sintetico-2026!");
        ciudadanoId=ciudadano("persona@example.invalid","00000001",hash).getId();
        ciudadano("otra@example.invalid","00000002",hash);
        Entidad e=new Entidad();e.setNombre("Entidad sintética");e.setAcronimo("SINT");entidadId=entidades.saveAndFlush(e).getId();
        token=login("persona@example.invalid");
    }
    Ciudadano ciudadano(String email,String dni,String hash){
        Ciudadano c=new Ciudadano();c.setEmail(email);c.setDni(dni);c.setNombreCompleto("Persona sintética");
        c.setPassword(hash);c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);return ciudadanos.saveAndFlush(c);
    }
    String login(String email) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("identificador",email,"password","Sintetico-2026!"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("token").asString();
    }
    String base(){return "/api/apelaciones/recepciones";}

    long solicitud() throws Exception {
        var r=mvc.perform(post("/api/solicitudes").header("Authorization","Bearer "+token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("ciudadanoId",ciudadanoId,"entidadId",entidadId,"asunto","Pedido sintético",
                "descripcion","Contenido sintético","consentimientoDatosPersonales",true,"canalNotificacion","CORREO_ELECTRONICO","formatoDigital",true))))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(r.getResponse().getContentAsString()).path("id").asLong();
    }
    long cuenta(String table){return jdbc.queryForObject("select count(*) from "+table,Long.class);}
    @Test void reproduceAltaLegacyConSubidaRechazadaConservaApelacionExpedienteEHistorial() throws Exception {
        long id=solicitud();
        var r=json.readTree(mvc.perform(post("/api/apelaciones").header("Authorization","Bearer "+token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("solicitudId",id,"ciudadanoId",ciudadanoId,"fundamentos","Revisión sintética"))))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(multipart("/api/documentos/upload").file(new MockMultipartFile("file","vacio.pdf","application/pdf",new byte[0]))
            .param("apelacionId",r.path("id").asString()).param("tipoDocumento","SOLICITUD_ORIGINAL")
            .header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(cuenta("apelaciones")).isEqualTo(1);assertThat(cuenta("documentos")).isZero();
        assertThat(cuenta("expedientes_ttaip")).isEqualTo(1);assertThat(cuenta("historial_ttaip")).isEqualTo(1);
        assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @Test void coordinadaRechazaArchivoVacioSinAlta() throws Exception {
        var datos=Map.of("claveOperacion",UUID.randomUUID().toString(),"modalidad","DIRECTA_TTAIP","solicitudId",solicitud(),"fundamentos","Revisión sintética",
            "documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL")));
        mvc.perform(multipart(base()).file(new MockMultipartFile("datos","","application/json",json.writeValueAsBytes(datos)))
            .file(new MockMultipartFile("archivos","vacio.pdf","application/pdf",new byte[0])).header("Authorization","Bearer "+token))
            .andExpect(status().isBadRequest());
        assertThat(cuenta("apelaciones")).isZero();assertThat(cuenta("documentos")).isZero();
    }

    static final byte[] BYTES="Antecedente sintético verificable".getBytes(StandardCharsets.UTF_8);
    String hash(byte[] bytes) throws Exception {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    MockMultipartFile archivo(String name){return new MockMultipartFile("archivos",name,"text/plain",BYTES);}
    Map<String,Object> vinculada(String key,long source){return new LinkedHashMap<>(Map.of("claveOperacion",key,"modalidad","DIRECTA_TTAIP","solicitudId",source,
        "fundamentos","Revisión sintética","documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL"))));}
    Map<String,Object> externa(String key){var datos=new LinkedHashMap<String,Object>(Map.of("claveOperacion",key,"modalidad","EXTERNA","entidadExternaNombre","Entidad declarada sintética",
        "numeroSolicitudExterna","EXT-1","fechaPresentacionSolicitudExterna","2026-10-01","tipoDenegatoria","TACITA","resumenSolicitudOriginal","Pedido externo sintético",
        "referenciaDocumentoSolicitud","Cargo declarado 1","evidenciaSilencioAdministrativo","Ausencia declarada de respuesta","fundamentos","Revisión sintética")); datos.put("documentos",List.of());return datos;}
    org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder envio(Map<String,Object> datos,MockMultipartFile... files) throws Exception {
        var r=multipart(base()).file(new MockMultipartFile("datos","","application/json",json.writeValueAsBytes(datos))).header("Authorization","Bearer "+token);
        for(var file:files)r.file(file);return r;
    }
    JsonNode recibir(Map<String,Object> datos,MockMultipartFile... files)throws Exception{return json.readTree(mvc.perform(envio(datos,files)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
    JsonNode recuperar(String key)throws Exception {
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+base()+"/"+key)).header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);return json.readTree(response.body());
    }
    JsonNode plazoEnPanel(long solicitudId) throws Exception {
        return json.readTree(mvc.perform(get("/api/panel/solicitudes").param("etapa","tribunal")
            .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
            .path("contenido").valueStream().filter(fila -> fila.path("id").asLong() == solicitudId)
            .findFirst().orElseThrow().path("apelacion").path("plazoPrimeraCalificacion");
    }
    @Test void panelCuentaDesdeLaRecepcionDirectaYNoDesdeUnaFechaDeApertura() throws Exception {
        long solicitudId = solicitud();
        var recepcion = recibir(vinculada(UUID.randomUUID().toString(),solicitudId),archivo("original.txt"));
        long apelacionId = recepcion.path("apelacion").path("id").asLong();
        LocalDate hoy = calendario.hoy();
        jdbc.update("update recepciones_alta_apelacion set fecha_recepcion=? where id_apelacion=?",hoy.atStartOfDay(),apelacionId);
        jdbc.update("update expedientes_ttaip set fecha_apertura=fecha_apertura - interval '30 days' where id_apelacion=?",apelacionId);
        assertThat(plazoEnPanel(solicitudId).path("diasRestantes").asInt()).isEqualTo(7);

        LocalDate ultimoDia = hoy;
        while (!calendario.esDiaHabil(ultimoDia)) ultimoDia = ultimoDia.plusDays(1);
        LocalDate base = ultimoDia;
        for (int dias = 0; dias < 7;) {
            base = base.minusDays(1);
            if (calendario.esDiaHabil(base)) dias++;
        }
        jdbc.update("update recepciones_alta_apelacion set fecha_recepcion=? where id_apelacion=?",base.atStartOfDay(),apelacionId);
        assertThat(plazoEnPanel(solicitudId).path("diasRestantes").asInt()).isEqualTo(1);
        assertThat(plazoEnPanel(solicitudId).path("vencido").asBoolean()).isFalse();

        jdbc.update("update recepciones_alta_apelacion set fecha_recepcion=? where id_apelacion=?",hoy.minusDays(30).atStartOfDay(),apelacionId);
        assertThat(plazoEnPanel(solicitudId).path("vencido").asBoolean()).isTrue();
        jdbc.update("update apelaciones set calificacion_primera='ADMISIBLE' where id_apelacion=?",apelacionId);
        assertThat(plazoEnPanel(solicitudId).isMissingNode()).isTrue();
        jdbc.update("update apelaciones set calificacion_primera=null where id_apelacion=?",apelacionId);
        jdbc.update("delete from recepciones_alta_apelacion where id_apelacion=?",apelacionId);
        assertThat(plazoEnPanel(solicitudId).isMissingNode()).isTrue();
        mvc.perform(get("/api/panel/solicitudes").param("etapa","tribunal")
                .header("Authorization","Bearer "+login("otra@example.invalid")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.contenido").isEmpty());
    }
    @Test void panelUsaLaRemisionRegistradaYNoLaPresentacionAnteLaEntidad() throws Exception {
        long solicitudId = solicitud();
        var datos = vinculada(UUID.randomUUID().toString(), solicitudId);
        datos.put("modalidad","ANTE_ENTIDAD");
        datos.put("fechaPresentacionAnteEntidad",calendario.hoy().toString());
        datos.put("referenciaCargoPresentacion","Cargo sintético");
        long apelacionId = recibir(datos,archivo("original.txt")).path("apelacion").path("id").asLong();
        assertThat(plazoEnPanel(solicitudId).isMissingNode()).isTrue();
        var funcionario = new Funcionario();
        funcionario.setEmail("remision@example.invalid");
        funcionario.setPassword(encoder.encode("Sintetico-2026!"));
        funcionario.setNombreCompleto("Funcionario sintético");
        funcionario.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);
        funcionario.setEntidad(entidades.findById(entidadId).orElseThrow());
        funcionarios.saveAndFlush(funcionario);
        mvc.perform(post("/api/apelaciones/"+apelacionId+"/elevacion/elevar")
                .header("Authorization","Bearer "+login(funcionario.getEmail())).contentType("application/json")
                .content(json.writeValueAsString(Map.of("responsableEntidad","Funcionario sintético","referenciaExpedienteElevado","Remisión sintética"))))
            .andExpect(status().isOk());
        jdbc.update("update recepciones_alta_apelacion set fecha_recepcion=fecha_recepcion - interval '30 days' where id_apelacion=?",apelacionId);
        assertThat(plazoEnPanel(solicitudId).path("diasRestantes").asInt()).isEqualTo(7);
    }
    JsonNode antecedente(long source)throws Exception {
        return subirAntecedente("solicitudId",source,"SOLICITUD_ORIGINAL","origen.txt",BYTES);
    }
    JsonNode subirAntecedente(String relacion,long id,String tipo,String nombre,byte[] bytes)throws Exception {
        return json.readTree(mvc.perform(multipart("/api/documentos/upload").file(new MockMultipartFile("file",nombre,"text/plain",bytes))
            .param(relacion,Long.toString(id)).param("tipoDocumento",tipo).header("Authorization","Bearer "+token))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }
    long archivos()throws IOException{try(var paths=Files.walk(LOCAL)){return paths.filter(Files::isRegularFile).count();}}
    void sinAlta(long originalFiles)throws Exception {
        for(String table:List.of("apelaciones","expedientes_ttaip","historial_ttaip","recepciones_alta_apelacion","recepcion_alta_apelacion_documentos","elevaciones_apelacion_ttaip","intentos_notificacion"))
            assertThat(cuenta(table)).as(table).isZero();
        assertThat(cuenta("documentos")).isEqualTo(originalFiles);assertThat(archivos()).isEqualTo(originalFiles);
    }
    @ParameterizedTest @ValueSource(strings={"DIRECTA_TTAIP","ANTE_ENTIDAD","EXTERNA"})
    void modalidadesPersistenRecuperanBytesYRepitenSinDuplicados(String modo)throws Exception {
        String key=UUID.randomUUID().toString();Map<String,Object> datos;
        if("EXTERNA".equals(modo))datos=externa(key);
        else {datos=vinculada(key,solicitud());datos.put("modalidad",modo);if("ANTE_ENTIDAD".equals(modo)){
            datos.put("fechaPresentacionAnteEntidad",java.time.LocalDate.now().toString());datos.put("referenciaCargoPresentacion","Cargo real sintético");}}
        datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL"),Map.of("tipoDocumento","RECURSO_APELACION")));
        var r=recibir(datos,archivo("original.txt"),archivo("recurso.txt"));
        assertThat(r.path("modalidad").asString()).isEqualTo(modo);assertThat(r.path("id").asLong()).isPositive();
        assertThat(r.path("apelacion").path("ciudadanoId").asLong()).isEqualTo(ciudadanoId);
        assertThat(r.path("apelacion").path("estado").asString()).isEqualTo("ANTE_ENTIDAD".equals(modo)?"PENDIENTE_ELEVACION":"EN_CALIFICACION_1");
        assertThat(cuenta("expedientes_ttaip")).isEqualTo("ANTE_ENTIDAD".equals(modo)?0:1);
        assertThat(cuenta("historial_ttaip")).isEqualTo("ANTE_ENTIDAD".equals(modo)?0:1);
        if ("ANTE_ENTIDAD".equals(modo)) {
            long solicitudId = r.path("apelacion").path("solicitudId").asLong();
            assertThat(plazoEnPanel(solicitudId).isMissingNode()).isTrue();
        }
        if("EXTERNA".equals(modo)){assertThat(r.path("apelacion").path("solicitudId").isNull()).isTrue();assertThat(cuenta("solicitudes")).isZero();}
        for(var item:r.path("documentos")) {
            var d=item.path("documento");assertThat(d.path("apelacionId").asLong()).isEqualTo(r.path("apelacion").path("id").asLong());
            assertThat(item.path("origenId").isNull()).isTrue();assertThat(item.path("hashAceptado").asString()).isEqualTo(hash(BYTES));
            var download=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/documentos/"+d.path("id").asLong()+"/download"))
                .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofByteArray());
            assertThat(download.statusCode()).isEqualTo(200);assertThat(download.body()).isEqualTo(BYTES);
        }
        assertThat(recuperar(key)).isEqualTo(r);assertThat(recibir(datos,archivo("original.txt"),archivo("recurso.txt"))).isEqualTo(r);
        assertThat(cuenta("apelaciones")).isEqualTo(1);assertThat(cuenta("documentos")).isEqualTo(2);assertThat(archivos()).isEqualTo(2);assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void externaPermiteReferenciasSinArchivosYExpresaOTacita(boolean expresa)throws Exception {
        var datos=externa(UUID.randomUUID().toString());
        if(expresa){datos.put("tipoDenegatoria","EXPRESA");datos.remove("evidenciaSilencioAdministrativo");datos.put("fechaRespuestaEntidad","2026-10-03");datos.put("referenciaRespuestaEntidad","Respuesta declarada");}
        var r=recibir(datos);assertThat(r.path("documentos").size()).isZero();assertThat(cuenta("solicitudes")).isZero();assertThat(cuenta("documentos")).isZero();
    }
    @Test void copiaVersionAutorizadaConProcedenciaPersistidaYNoDependeDeLaVersionFutura()throws Exception {
        long s=solicitud();var origen=antecedente(s);String key=UUID.randomUUID().toString();var datos=vinculada(key,s);
        datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL","origenId",origen.path("id").asLong(),"hashOrigen",origen.path("hashSha256").asString())));
        var r=recibir(datos);var d=r.path("documentos").get(0);
        assertThat(d.path("origenId").asLong()).isEqualTo(origen.path("id").asLong());assertThat(d.path("documento").path("id").asLong()).isNotEqualTo(origen.path("id").asLong());
        jdbc.update("update documentos set hash_sha256=? where id_documento=?","f".repeat(64),origen.path("id").asLong());
        assertThat(recibir(datos)).isEqualTo(r);assertThat(recuperar(key)).isEqualTo(r);assertThat(cuenta("documentos")).isEqualTo(2);
    }
    @Test void noAceptaVersionDistintaNiAntecedenteDeOtraSolicitudAunqueSeaDelMismoCiudadano()throws Exception {
        long a=solicitud(),b=solicitud();var origen=antecedente(a);var datos=vinculada(UUID.randomUUID().toString(),b);
        datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL","origenId",origen.path("id").asLong(),"hashOrigen",origen.path("hashSha256").asString())));
        mvc.perform(envio(datos)).andExpect(status().isConflict());sinAlta(1);
        datos.put("solicitudId",a);datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL","origenId",origen.path("id").asLong(),"hashOrigen","e".repeat(64))));
        mvc.perform(envio(datos)).andExpect(status().isConflict());sinAlta(1);
    }
    @ParameterizedTest @ValueSource(strings={"fundamentos","modalidad","bytes","nombre","documentos"})
    void claveIncompatibleNoDuplicaActuaciones(String campo)throws Exception {
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());recibir(datos,archivo("original.txt"));
        MockMultipartFile file=archivo("original.txt");
        if(campo.equals("fundamentos"))datos.put(campo,"Otra revisión");
        if(campo.equals("modalidad")){datos.put(campo,"ANTE_ENTIDAD");datos.put("fechaPresentacionAnteEntidad",java.time.LocalDate.now().toString());datos.put("referenciaCargoPresentacion","Cargo");}
        if(campo.equals("bytes"))file=new MockMultipartFile("archivos","original.txt","text/plain","otros bytes".getBytes());
        if(campo.equals("nombre"))file=archivo("otro.txt");
        if(campo.equals("documentos")){datos.put("documentos",List.of(Map.of("tipoDocumento","RECURSO_APELACION")));}
        mvc.perform(envio(datos,file)).andExpect(status().isConflict());assertThat(cuenta("apelaciones")).isEqualTo(1);assertThat(cuenta("historial_ttaip")).isEqualTo(1);assertThat(archivos()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"ciudadanoId","estado","fechaApelacion","authVersion","documentoIds","expediente"})
    void noAdmiteIdentidadEstadoNiDocumentosArbitrarios(String campo)throws Exception {
        var datos=externa(UUID.randomUUID().toString());datos.put(campo,"1");mvc.perform(envio(datos)).andExpect(status().isBadRequest());sinAlta(0);
    }
    @Test void rechazaOtroCiudadanoSuplantacionOrigenYDescarga()throws Exception {
        long s=solicitud();var datos=vinculada(UUID.randomUUID().toString(),s);var r=recibir(datos,archivo("original.txt"));String own=token;
        token=login("otra@example.invalid");mvc.perform(envio(datos,archivo("original.txt"))).andExpect(status().isForbidden());
        mvc.perform(get(base()+"/"+datos.get("claveOperacion")).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        datos.put("claveOperacion",UUID.randomUUID().toString());mvc.perform(envio(datos,archivo("original.txt"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/documentos/"+r.path("documentos").get(0).path("documento").path("id").asLong()+"/download").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        token=own;assertThat(cuenta("apelaciones")).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"FUNCIONARIO","TTAIP","ADMINISTRADOR"})
    void nuevaRecepcionNoUsaPrivilegiosAdministrativos(String role)throws Exception {
        Usuario u=new Usuario();u.setEmail("rol@example.invalid");u.setTipoUsuario(Usuario.TipoUsuario.valueOf(role));u.setPassword(encoder.encode("Sintetico-2026!"));usuarios.saveAndFlush(u);
        token=login(u.getEmail());mvc.perform(envio(externa(UUID.randomUUID().toString()))).andExpect(status().isForbidden());
        mvc.perform(get(base()+"/"+UUID.randomUUID()).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());sinAlta(0);
    }
    @Test void requiereSesionYConservaRequisitosPorModalidad()throws Exception {
        mvc.perform(multipart(base())).andExpect(status().isUnauthorized());
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());datos.put("documentos",List.of());mvc.perform(envio(datos)).andExpect(status().isBadRequest());sinAlta(0);
        datos.put("modalidad","ANTE_ENTIDAD");datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL")));
        mvc.perform(envio(datos,archivo("original.txt"))).andExpect(status().isBadRequest());sinAlta(0);
        // Existing external-appeal business validation classifies missing silence evidence as 422.
        var externa=externa(UUID.randomUUID().toString());externa.remove("evidenciaSilencioAdministrativo");
        mvc.perform(envio(externa)).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.title").value("Business rule violation"));sinAlta(0);
    }
    @Test void falloDuranteSubidaCompensaCopiaPreviaYConservaAntecedente()throws Exception {
        long s=solicitud();var origen=antecedente(s);var datos=vinculada(UUID.randomUUID().toString(),s);
        datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL","origenId",origen.path("id").asLong(),"hashOrigen",hash(BYTES)),Map.of("tipoDocumento","RECURSO_APELACION")));
        AtomicInteger opens=new AtomicInteger();Path backup=LOCAL.resolveSibling(LOCAL.getFileName()+"-backup");
        var broken=new MockMultipartFile("archivos","recurso.txt","text/plain",BYTES){@Override public InputStream getInputStream()throws IOException{
            InputStream in=super.getInputStream();if(opens.incrementAndGet()!=2)return in;Files.move(LOCAL,backup);Files.createFile(LOCAL);
            return new FilterInputStream(in){private int closes;@Override public void close()throws IOException{super.close();if(++closes==2){Files.delete(LOCAL);Files.move(backup,LOCAL);}}};}};
        mvc.perform(envio(datos,broken)).andExpect(status().isInternalServerError());sinAlta(1);
        recibir(datos,archivo("recurso.txt"));assertThat(archivos()).isEqualTo(3);
    }
    @Test void falloPersistenciaTrasClonYSubidaRevierteHistorialYCompensaSoloCopias()throws Exception {
        long s=solicitud();var origen=antecedente(s);var datos=vinculada(UUID.randomUUID().toString(),s);
        datos.put("documentos",List.of(Map.of("tipoDocumento","SOLICITUD_ORIGINAL","origenId",origen.path("id").asLong(),"hashOrigen",hash(BYTES)),Map.of("tipoDocumento","RECURSO_APELACION")));
        jdbc.execute("CREATE FUNCTION apelacion_rechazada() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo sintético' USING ERRCODE='23514'; END $$");
        jdbc.execute("CREATE TRIGGER apelacion_rechazada BEFORE INSERT ON recepciones_alta_apelacion FOR EACH ROW EXECUTE FUNCTION apelacion_rechazada()");
        try{mvc.perform(envio(datos,archivo("recurso.txt"))).andExpect(status().isConflict());sinAlta(1);}
        finally{jdbc.execute("DROP TRIGGER apelacion_rechazada ON recepciones_alta_apelacion");jdbc.execute("DROP FUNCTION apelacion_rechazada()");}
        mvc.perform(get(base()+"/"+datos.get("claveOperacion")).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        recibir(datos,archivo("recurso.txt"));assertThat(cuenta("historial_ttaip")).isEqualTo(1);
    }
    @Test void perdidaConfirmacionTrasCommitSeRecuperaSinRepetirAlta()throws Exception {
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());
        assertThatThrownBy(()->mvc.perform(envio(datos,archivo("original.txt")).header("X-Sintetico-Descartar","true"))).isInstanceOf(IOException.class);
        var r=recuperar(datos.get("claveOperacion").toString());assertThat(recibir(datos,archivo("original.txt"))).isEqualTo(r);
        assertThat(cuenta("apelaciones")).isEqualTo(1);assertThat(cuenta("historial_ttaip")).isEqualTo(1);assertThat(cuenta("documentos")).isEqualTo(1);assertThat(cuenta("intentos_notificacion")).isZero();
    }
    byte[] cuerpo(Map<String,Object> datos)throws Exception {
        ByteArrayOutputStream out=new ByteArrayOutputStream();out.write("--YAIKU\r\nContent-Disposition: form-data; name=\"datos\"\r\nContent-Type: application/json\r\n\r\n".getBytes());
        out.write(json.writeValueAsBytes(datos));out.write("\r\n--YAIKU\r\nContent-Disposition: form-data; name=\"archivos\"; filename=\"original.txt\"\r\nContent-Type: text/plain\r\n\r\n".getBytes());out.write(BYTES);out.write("\r\n--YAIKU--\r\n".getBytes());return out.toByteArray();
    }
    @ParameterizedTest @ValueSource(strings={"misma","incompatible","otra-clave","otra-solicitud"})
    void conexionesIndependientesNoDuplicanNiColisionanEnNumero(String caso)throws Exception {
        long source=solicitud();var first=vinculada(UUID.randomUUID().toString(),source);var second=new LinkedHashMap<>(first);
        if(caso.equals("incompatible"))second.put("fundamentos","Distinto contenido");
        if(caso.equals("otra-clave")||caso.equals("otra-solicitud"))second.put("claveOperacion",UUID.randomUUID().toString());
        if(caso.equals("otra-solicitud"))second.put("solicitudId",solicitud());
        byte[] one=cuerpo(first),two=cuerpo(second);
        try(var executor=Executors.newFixedThreadPool(3)) {
            CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1);
            var holder=executor.submit(()->new TransactionTemplate(manager).execute(tx->{jdbc.execute("select pg_advisory_xact_lock(1396787536, 2)");held.countDown();
                try{if(!release.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Espera sintética agotada");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}return null;}));
            assertThat(held.await(10,TimeUnit.SECONDS)).isTrue();
            java.util.function.Function<byte[],HttpResponse<String>> send=body->{try{return HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+base()))
                .header("Authorization","Bearer "+token).header("Content-Type","multipart/form-data; boundary=YAIKU").POST(HttpRequest.BodyPublishers.ofByteArray(body)).build(),HttpResponse.BodyHandlers.ofString());}catch(Exception e){throw new IllegalStateException(e);}};
            var a=executor.submit(()->send.apply(one));var b=executor.submit(()->send.apply(two));
            try{long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(12),waiting=0;while(System.nanoTime()<end){waiting=jdbc.queryForObject("select count(distinct pid) from pg_stat_activity where datname=current_database() and wait_event_type='Lock'",Long.class);if(waiting>=2)break;Thread.sleep(20);}assertThat(waiting).isGreaterThanOrEqualTo(2);}
            finally{release.countDown();}holder.get(15,TimeUnit.SECONDS);var ra=a.get(20,TimeUnit.SECONDS);var rb=b.get(20,TimeUnit.SECONDS);
            assertThat(List.of(ra.statusCode(),rb.statusCode())).containsExactlyInAnyOrder(200,caso.equals("misma")||caso.equals("otra-solicitud")?200:409);
            if(caso.equals("misma"))assertThat(json.readTree(ra.body()).path("id").asLong()).isEqualTo(json.readTree(rb.body()).path("id").asLong());
        }
        int count=caso.equals("otra-solicitud")?2:1;assertThat(cuenta("apelaciones")).isEqualTo(count);assertThat(cuenta("documentos")).isEqualTo(count);
        assertThat(cuenta("historial_ttaip")).isEqualTo(count);assertThat(archivos()).isEqualTo(count);
    }

    @Test void documentoRetiradoNoSePresentaComoRecepcionAusenteNiSeRecrea()throws Exception {
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());var r=recibir(datos,archivo("original.txt"));
        Documento doc=documentos.findById(r.path("documentos").get(0).path("documento").path("id").asLong()).orElseThrow();Files.delete(LOCAL.resolve(doc.getStorageKey()));
        mvc.perform(get(base()+"/"+datos.get("claveOperacion")).header("Authorization","Bearer "+token)).andExpect(status().isInternalServerError());
        mvc.perform(envio(datos,archivo("original.txt"))).andExpect(status().isInternalServerError());assertThat(cuenta("apelaciones")).isEqualTo(1);assertThat(cuenta("historial_ttaip")).isEqualTo(1);
    }
    @Test void documentoReasociadoAOtraApelacionNoEsManifiestoCompatible()throws Exception {
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());var first=recibir(datos,archivo("original.txt"));
        var other=recibir(vinculada(UUID.randomUUID().toString(),solicitud()),archivo("original.txt"));
        jdbc.update("update documentos set id_apelacion=? where id_documento=?",other.path("apelacion").path("id").asLong(),first.path("documentos").get(0).path("documento").path("id").asLong());
        mvc.perform(get(base()+"/"+datos.get("claveOperacion")).header("Authorization","Bearer "+token)).andExpect(status().isConflict());assertThat(cuenta("apelaciones")).isEqualTo(2);
    }
    @Test void respuestaExpresaExigeSuDocumentoYCopiaTodosLosAntecedentesAutorizados()throws Exception {
        long source=solicitud();var original=antecedente(source);
        byte[] bytesAnexo="Anexo original".getBytes(StandardCharsets.UTF_8);
        byte[] bytesSegundaRespuesta="Segundo archivo de respuesta".getBytes(StandardCharsets.UTF_8);
        var anexo=subirAntecedente("solicitudId",source,"DOCUMENTO_ADJUNTO","anexo.txt",bytesAnexo);
        var otroAnexo=subirAntecedente("solicitudId",solicitud(),"DOCUMENTO_ADJUNTO","otro.txt",bytesAnexo);
        pe.gob.saip.backend.model.entity.Funcionario funcionario=new pe.gob.saip.backend.model.entity.Funcionario();
        funcionario.setEmail("funcionario@example.invalid");funcionario.setPassword(encoder.encode("Sintetico-2026!"));funcionario.setNombreCompleto("Funcionario sintético");
        funcionario.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);funcionario.setEntidad(entidades.findById(entidadId).orElseThrow());
        funcionario=funcionarios.saveAndFlush(funcionario);String own=token;token=login(funcionario.getEmail());
        mvc.perform(patch("/api/solicitudes/"+source+"/estado").contentType("application/json").content("{\"estado\":\"EN_REVISION\"}").header("Authorization","Bearer "+token)).andExpect(status().isOk());
        var answer=json.readTree(mvc.perform(post("/api/respuestas").contentType("application/json").header("Authorization","Bearer "+token)
            .content(json.writeValueAsString(Map.of("solicitudId",source,"funcionarioId",funcionario.getId(),"tipoRespuesta","DENEGACION_TOTAL","contenido","Respuesta sintética","causalDenegatoria","Causal sintética","fundamentoLegal","Fundamento sintético"))))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        long respuestaId=answer.path("id").asLong();
        var response=subirAntecedente("respuestaId",respuestaId,"RESPUESTA_ENTIDAD","respuesta.txt",BYTES);
        var segunda=subirAntecedente("respuestaId",respuestaId,"RESPUESTA_ENTIDAD","respuesta.txt",bytesSegundaRespuesta);
        token=own;

        String clave=UUID.randomUUID().toString();
        var datos=vinculada(clave,source);
        datos.put("documentos",List.of(entradaAntecedente(original),entradaAntecedente(anexo)));
        mvc.perform(envio(datos)).andExpect(status().isBadRequest());sinAlta(5);
        datos.put("documentos",List.of(entradaAntecedente(original),entradaAntecedente(otroAnexo),entradaAntecedente(response)));
        mvc.perform(envio(datos)).andExpect(status().isConflict());sinAlta(5);
        datos.put("documentos",List.of(entradaAntecedente(anexo),entradaAntecedente(response)));
        mvc.perform(envio(datos)).andExpect(status().isBadRequest());sinAlta(5);

        List<JsonNode> origenes=List.of(original,anexo,response,segunda);
        datos.put("documentos",origenes.stream().map(this::entradaAntecedente).toList());
        var r=recibir(datos);
        var adjuntos=r.path("documentos");
        assertThat(adjuntos.size()).isEqualTo(origenes.size());
        var bytesPorDocumento=List.of(BYTES,bytesAnexo,BYTES,bytesSegundaRespuesta);
        for(int i=0;i<origenes.size();i++){
            var origen=origenes.get(i);
            var entrada=adjuntos.get(i);
            var copia=entrada.path("documento");
            assertThat(entrada.path("origenId").asLong()).isEqualTo(origen.path("id").asLong());
            assertThat(copia.path("id").asLong()).isNotEqualTo(origen.path("id").asLong());
            assertThat(copia.path("tipoDocumento").asString()).isEqualTo(origen.path("tipoDocumento").asString());
            assertThat(copia.path("apelacionId").asLong()).isEqualTo(r.path("apelacion").path("id").asLong());
            assertThat(entrada.path("hashAceptado").asString()).isEqualTo(hash(bytesPorDocumento.get(i)));
            mvc.perform(get("/api/documentos/"+copia.path("id").asLong()+"/download").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(content().bytes(bytesPorDocumento.get(i)));
        }
        assertThat(recuperar(clave)).isEqualTo(r);
        assertThat(recibir(datos)).isEqualTo(r);
        assertThat(cuenta("apelaciones")).isEqualTo(1);
        assertThat(cuenta("documentos")).isEqualTo(9);
        assertThat(archivos()).isEqualTo(9);
    }

    private Map<String,Object> entradaAntecedente(JsonNode documento){
        return Map.of("tipoDocumento",documento.path("tipoDocumento").asString(),"origenId",documento.path("id").asLong(),
            "hashOrigen",documento.path("hashSha256").asString());
    }

    @Test void nombreNormalizadoNoCambiaIdentidadNiBytesAceptados()throws Exception {
        var datos=vinculada(UUID.randomUUID().toString(),solicitud());var r=recibir(datos,archivo("copia  real.txt"));
        assertThat(r.path("documentos").get(0).path("documento").path("nombreOriginal").asString()).isEqualTo("copia real.txt");
        assertThat(r.path("documentos").get(0).path("hashAceptado").asString()).isEqualTo(hash(BYTES));assertThat(recuperar(datos.get("claveOperacion").toString())).isEqualTo(r);
    }
    @Test void flywayValidateYContratoCompletoReal()throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();assertThat(flyway.info().pending()).isEmpty();
        assertThat(Arrays.stream(flyway.info().applied()).map(m->m.getVersion().toString()).toList())
            .containsExactly("1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17");
        String dir=System.getenv("ALTA_APELACION_POSTGRES_ARTIFACTS");if(dir!=null){var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            var contract=json.readTree(response.body());var schemas=contract.path("components").path("schemas");
            assertThat(schemas.path("RegistrarAltaApelacionRequest").path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(schemas.path("DocumentoAltaApelacionRequest").path("additionalProperties").asBoolean(true)).isFalse();
            assertThat(schemas.path("RegistrarAltaApelacionRequest").path("properties").path("solicitudId").path("minimum").asInt()).isEqualTo(1);
            assertThat(schemas.path("DocumentoAltaApelacionRequest").path("properties").path("origenId").path("minimum").asInt()).isEqualTo(1);
            var post=contract.path("paths").path(base()).path("post");
            assertThat(post.path("requestBody").path("required").asBoolean()).isTrue();
            assertThat(post.path("requestBody").path("content").path("multipart/form-data").path("encoding").path("datos").path("contentType").asString()).isEqualTo("application/json");
            assertThat(post.path("responses").path("422").path("content").has("application/problem+json")).isTrue();
            Files.writeString(Path.of(dir,"openapi-alta-apelacion.json"),response.body());
            Files.writeString(Path.of(dir,"flyway-alta-apelacion.txt"),Arrays.toString(Arrays.stream(flyway.info().applied()).map(m->m.getVersion()+" "+m.getDescription()+" "+m.getChecksum()).toArray()));}
    }
    @TestConfiguration static class DescartarConfirmacion {
        @Bean Filter descartarAltaApelacion(){return (request,response,chain)->{chain.doFilter(request,response);
            if("true".equals(((HttpServletRequest)request).getHeader("X-Sintetico-Descartar")))throw new IOException("Confirmación descartada tras commit, solo prueba");};}
    }
}
