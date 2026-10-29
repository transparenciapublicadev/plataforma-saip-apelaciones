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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Opt-in own PostgreSQL, original Flyway, real JWT/security/JPA/LOCAL; external providers MOCK. */
@EnabledIfEnvironmentVariable(named="RUN_ALTA_SAIP_POSTGRES_TESTS", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "server.address=127.0.0.1", "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "springdoc.default-produces-media-type=application/json", "springdoc.default-consumes-media-type=application/json",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Import(AltaSaipRecepcionPostgresIntegrationTest.DescartarConfirmacion.class)
class AltaSaipRecepcionPostgresIntegrationTest {
    private static final Path LOCAL=temporal();
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder encoder;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired UsuarioRepository usuarios;
    @Autowired EntidadRepository entidades;
    @Autowired DocumentoRepository documentos;
    @Autowired Flyway flyway;
    @Autowired PlatformTransactionManager manager;
    @LocalServerPort int port;
    long ciudadanoId, entidadId;
    String token;

    @DynamicPropertySource static void propiedades(DynamicPropertyRegistry r) {
        String url=System.getenv("ALTA_SAIP_POSTGRES_URL");
        if(url==null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base propia temporal en loopback");
        r.add("spring.datasource.url",()->url); r.add("spring.datasource.username",()->"yaiku_e11_test");
        r.add("spring.datasource.password",()->""); r.add("app.storage.local.base-path",()->LOCAL.toString());
    }
    static Path temporal() {try{return Files.createTempDirectory("yaiku-alta-saip-");}catch(Exception e){throw new IllegalStateException(e);}}
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
    String base(){return "/api/solicitudes/recepciones";}
    org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder envio(String key,MockMultipartFile... files){
        var r=multipart(base()).param("claveOperacion",key).param("entidadId",Long.toString(entidadId))
            .param("asunto","Pedido sintético").param("descripcion","Información sintética solicitada")
            .param("consentimientoDatosPersonales","true").param("declaraVeracidad","true").param("canalNotificacion","CORREO_ELECTRONICO")
            .param("formatoDigital","true").param("formatoFisico","false").param("copiaSimple","false").param("copiaCertificada","false")
            .header("Authorization","Bearer "+token);
        for(int i=0;i<files.length;i++){r.file(files[i]);r.param("tiposDocumento",i==0?"SOLICITUD_ORIGINAL":"DOCUMENTO_ADJUNTO");}return r;
    }
    long cuenta(String table){return jdbc.queryForObject("select count(*) from "+table,Long.class);}
    private static final byte[] PDF="%PDF-1.4\nContenido sintético verificable\n%%EOF".getBytes(StandardCharsets.UTF_8);
    MockMultipartFile pdf(String name){return new MockMultipartFile("archivos",name,"application/pdf",PDF);}
    long archivos() throws IOException{try(var p=Files.walk(LOCAL)){return p.filter(Files::isRegularFile).count();}}
    void sinEfectos() throws IOException {
        for(String t:List.of("solicitudes","documentos","recepciones_alta_saip","recepcion_alta_saip_documentos","intentos_notificacion"))assertThat(cuenta(t)).as(t).isZero();
        assertThat(archivos()).isZero();
    }

    @Test void reproduceAltaLegacyConSubidaFallidaDejaSolicitudPersistida() throws Exception {
        var created=json.readTree(mvc.perform(post("/api/solicitudes").header("Authorization","Bearer "+token).contentType("application/json")
            .content(json.writeValueAsString(Map.of("ciudadanoId",ciudadanoId,"entidadId",entidadId,"asunto","Pedido sintético",
                "descripcion","Información sintética solicitada","consentimientoDatosPersonales",true,"canalNotificacion","CORREO_ELECTRONICO","formatoDigital",true))))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(multipart("/api/documentos/upload").file(new MockMultipartFile("file","anexo.pdf","application/pdf",new byte[0]))
            .param("solicitudId",created.path("id").asString()).param("tipoDocumento","SOLICITUD_ORIGINAL")
            .header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("documentos")).isZero();assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @Test void altaCoordinadaNoRegistraSeleccionIncompleta() throws Exception {
        mvc.perform(envio(UUID.randomUUID().toString(),new MockMultipartFile("archivos","anexo.pdf","application/pdf",new byte[0])))
            .andExpect(status().isBadRequest());
        assertThat(cuenta("solicitudes")).isZero();assertThat(cuenta("documentos")).isZero();
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void recibeArchivosOpcionalesRecuperaBytesHashYRelacionesSinDuplicar(boolean files) throws Exception {
        String key=UUID.randomUUID().toString();
        JsonNode r=json.readTree(mvc.perform(envio(key,files?new MockMultipartFile[]{pdf("original.pdf"),pdf("anexo.pdf")}:new MockMultipartFile[0]))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        long id=r.path("solicitud").path("id").asLong();
        assertThat(r.path("id").asLong()).isPositive();assertThat(r.path("declaraVeracidad").asBoolean()).isTrue();
        assertThat(r.path("solicitud").path("ciudadanoId").asLong()).isEqualTo(ciudadanoId);
        assertThat(r.path("solicitud").path("estado").asString()).isEqualTo("RECEPCIONADA");
        assertThat(r.path("solicitud").path("expediente").asString()).startsWith("SAIP-");
        assertThat(r.path("documentos").size()).isEqualTo(files?2:0);assertThat(archivos()).isEqualTo(files?2:0);
        for(var d:r.path("documentos")) {
            assertThat(d.path("solicitudId").asLong()).isEqualTo(id);assertThat(d.path("respuestaId").isNull()).isTrue();
            assertThat(d.path("hashSha256").asString()).isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PDF)));
            var bytes=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/documentos/"+d.path("id").asLong()+"/download"))
                .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofByteArray());
            assertThat(bytes.statusCode()).isEqualTo(200);assertThat(bytes.body()).isEqualTo(PDF);
        }
        var recovered=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+base()+"/"+key))
            .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString());
        assertThat(recovered.statusCode()).isEqualTo(200);assertThat(json.readTree(recovered.body())).isEqualTo(r);
        assertThat(recovered.body()).doesNotContain("huellaSolicitud","storageKey","storageBucket");
        mvc.perform(envio(key,files?new MockMultipartFile[]{pdf("original.pdf"),pdf("anexo.pdf")}:new MockMultipartFile[0]))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(r.path("id").asLong()));
        assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("recepciones_alta_saip")).isEqualTo(1);
        assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @Test void consultaAusenteNoCreaUnaSolicitudNiReenviaEfectos() throws Exception {
        mvc.perform(get(base()+"/"+UUID.randomUUID()).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());sinEfectos();
    }
    @Test void claveIncompatibleNoDuplicaYHuellaIncluyeCamposTiposNombresYBytes() throws Exception {
        String key=UUID.randomUUID().toString();mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isOk());
        for(var changed:List.of(envio(key),envio(key,pdf("b.pdf")),envio(key,new MockMultipartFile("archivos","a.pdf","application/pdf","%PDF-1.4\nOtros bytes\n%%EOF".getBytes(StandardCharsets.UTF_8))),
                envio(key,pdf("a.pdf")).with(r->{r.setParameter("asunto","Otro contenido");return r;}),
                envio(key,pdf("a.pdf")).with(r->{r.setParameter("tiposDocumento","DOCUMENTO_ADJUNTO");return r;}),
                envio(key,pdf("a.pdf")).with(r->{r.setParameter("canalNotificacion","FISICA");return r;})))
            mvc.perform(changed).andExpect(status().isConflict());
        assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("documentos")).isEqualTo(1);assertThat(archivos()).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"ciudadanoId","id","estado","prioridad","fechaPresentacion","fechaLimite","documentoIds","documentos","creadoPor","rutaArchivo"})
    void rechazaAtributosControladosPorServidor(String field) throws Exception {
        mvc.perform(envio(UUID.randomUUID().toString()).param(field,"1")).andExpect(status().isBadRequest());sinEfectos();
    }
    @ParameterizedTest @ValueSource(strings={"asunto","descripcion","consentimientoDatosPersonales","declaraVeracidad","canalNotificacion","modalidad","tipos"})
    void validacionNoDejaAltaParcial(String field) throws Exception {
        var r=envio(UUID.randomUUID().toString(),pdf("a.pdf")).with(req->{
            if(field.equals("modalidad"))req.setParameter("formatoDigital","false");
            else if(field.equals("tipos"))req.setParameter("tiposDocumento","RESOLUCION_TTAIP");
            else req.setParameter(field,field.endsWith("Personales") || field.equals("declaraVeracidad")?"false":"");return req;
        });mvc.perform(r).andExpect(status().isBadRequest());sinEfectos();
    }
    @Test void respetaEntidadExistenteYActiva() throws Exception {
        mvc.perform(envio(UUID.randomUUID().toString()).with(r->{r.setParameter("entidadId","99999");return r;})).andExpect(status().isNotFound());sinEfectos();
        jdbc.update("update entidades set estado='Inactiva' where id_entidad=?",entidadId);
        mvc.perform(envio(UUID.randomUUID().toString())).andExpect(status().isConflict());sinEfectos();
    }
    @Test void otroCiudadanoNoRecuperaNiSuplantaLaOperacionODocumentos() throws Exception {
        String key=UUID.randomUUID().toString();JsonNode r=json.readTree(mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String original=token;token=login("otra@example.invalid");
        mvc.perform(get(base()+"/"+key).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/documentos/"+r.path("documentos").get(0).path("id").asLong()+"/download").header("Authorization","Bearer "+token)).andExpect(status().isForbidden());
        token=original;assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("documentos")).isEqualTo(1);
    }
    @ParameterizedTest @ValueSource(strings={"FUNCIONARIO","TTAIP","ADMINISTRADOR"})
    void noAmpliaAltaCiudadanaAOtrosRoles(String role) throws Exception {
        Usuario user=new Usuario();user.setEmail("rol@example.invalid");user.setPassword(encoder.encode("Sintetico-2026!"));user.setTipoUsuario(Usuario.TipoUsuario.valueOf(role));usuarios.saveAndFlush(user);
        token=login(user.getEmail());mvc.perform(envio(UUID.randomUUID().toString())).andExpect(status().isForbidden());
        mvc.perform(get(base()+"/"+UUID.randomUUID()).header("Authorization","Bearer "+token)).andExpect(status().isForbidden());sinEfectos();
    }
    @Test void requiereBearerValido() throws Exception {
        mvc.perform(multipart(base())).andExpect(status().isUnauthorized());
        mvc.perform(get(base()+"/"+UUID.randomUUID())).andExpect(status().isUnauthorized());sinEfectos();
    }
    @Test void falloDuranteSegundaSubidaCompensaPrimeraYRevierteSolicitud() throws Exception {
        AtomicInteger opens=new AtomicInteger();Path backup=LOCAL.resolveSibling(LOCAL.getFileName()+"-backup");
        var broken=new MockMultipartFile("archivos","b.pdf","application/pdf",PDF){@Override public InputStream getInputStream()throws IOException{
            InputStream in=super.getInputStream();if(opens.incrementAndGet()!=2)return in;
            Files.move(LOCAL,backup);Files.createFile(LOCAL);
            return new FilterInputStream(in){@Override public void close()throws IOException{try{super.close();}finally{Files.delete(LOCAL);Files.move(backup,LOCAL);}}};
        }};
        String key=UUID.randomUUID().toString();mvc.perform(envio(key,pdf("a.pdf"),broken)).andExpect(status().isInternalServerError());sinEfectos();
        mvc.perform(envio(key,pdf("a.pdf"),pdf("b.pdf"))).andExpect(status().isOk());assertThat(cuenta("solicitudes")).isEqualTo(1);
    }
    @Test void falloPersistenciaTrasSubidasCompensaTodosLosObjetos() throws Exception {
        jdbc.execute("CREATE FUNCTION alta_rechazada() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo sintético' USING ERRCODE='23514'; END $$");
        jdbc.execute("CREATE TRIGGER alta_rechazada BEFORE INSERT ON recepciones_alta_saip FOR EACH ROW EXECUTE FUNCTION alta_rechazada()");
        String key=UUID.randomUUID().toString();
        try{mvc.perform(envio(key,pdf("a.pdf"),pdf("b.pdf"))).andExpect(status().isConflict());sinEfectos();}
        finally{jdbc.execute("DROP TRIGGER alta_rechazada ON recepciones_alta_saip");jdbc.execute("DROP FUNCTION alta_rechazada()");}
        mvc.perform(get(base()+"/"+key).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        mvc.perform(envio(key,pdf("a.pdf"),pdf("b.pdf"))).andExpect(status().isOk());assertThat(archivos()).isEqualTo(2);
    }
    @Test void bytesCambiadosTrasLaHuellaNoSeConfirman() throws Exception {
        AtomicInteger opens=new AtomicInteger();
        var changed=new MockMultipartFile("archivos","a.pdf","application/pdf",PDF){@Override public InputStream getInputStream(){
            byte[] bytes=PDF.clone();if(opens.incrementAndGet()>1)bytes[12]=(byte)(bytes[12]+1);return new ByteArrayInputStream(bytes);
        }};
        mvc.perform(envio(UUID.randomUUID().toString(),changed)).andExpect(status().isConflict());sinEfectos();
    }
    @Test void compensacionFallidaNoAfirmaQueElObjetoResidualFueEliminado() throws Exception {
        AtomicInteger opens=new AtomicInteger();
        var broken=new MockMultipartFile("archivos","b.pdf","application/pdf",PDF){@Override public InputStream getInputStream()throws IOException{
            InputStream in=super.getInputStream();if(opens.incrementAndGet()!=2)return in;
            return new FilterInputStream(in){@Override public void close()throws IOException{
                super.close();Path first;try(var paths=Files.walk(LOCAL)){first=paths.filter(Files::isRegularFile).findFirst().orElseThrow();}
                byte[] bytes=Files.readAllBytes(first);Files.delete(first);Files.createDirectory(first);Files.write(first.resolve("residual"),bytes);
                throw new IOException("Fallo sintético posterior a subida");
            }};
        }};
        mvc.perform(envio(UUID.randomUUID().toString(),pdf("a.pdf"),broken)).andExpect(status().isInternalServerError());
        assertThat(cuenta("solicitudes")).isZero();assertThat(cuenta("documentos")).isZero();assertThat(cuenta("recepciones_alta_saip")).isZero();
        assertThat(archivos()).as("residuo requiere reparación operativa; no hay atomicidad distribuida").isEqualTo(1);
    }
    @Test void perdidaDeConfirmacionDespuesDeCommitRecuperaSinOtraAlta() throws Exception {
        String key=UUID.randomUUID().toString();
        assertThatThrownBy(()->mvc.perform(envio(key,pdf("a.pdf")).header("X-Sintetico-Descartar","true"))).isInstanceOf(IOException.class);
        assertThat(cuenta("solicitudes")).isEqualTo(1);
        JsonNode r=json.readTree(mvc.perform(get(base()+"/"+key).header("Authorization","Bearer "+token)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(r.path("id").asLong()));
        assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(archivos()).isEqualTo(1);assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @Test void archivoPerdidoTrasCommitNoEsRecepcionAusenteNiPermiteRecrear() throws Exception {
        String key=UUID.randomUUID().toString();JsonNode r=json.readTree(mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        Documento d=documentos.findById(r.path("documentos").get(0).path("id").asLong()).orElseThrow();Files.delete(LOCAL.resolve(d.getStorageKey()));
        mvc.perform(get(base()+"/"+key).header("Authorization","Bearer "+token)).andExpect(status().isInternalServerError());
        mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isInternalServerError());assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("recepciones_alta_saip")).isEqualTo(1);
    }
    byte[] cuerpoHttp(String key,String asunto) throws IOException {
        var fields=new LinkedHashMap<String,String>();fields.put("claveOperacion",key);fields.put("entidadId",Long.toString(entidadId));
        fields.put("asunto",asunto);fields.put("descripcion","Información sintética solicitada");fields.put("consentimientoDatosPersonales","true");
        fields.put("declaraVeracidad","true");fields.put("canalNotificacion","CORREO_ELECTRONICO");fields.put("formatoDigital","true");
        fields.put("formatoFisico","false");fields.put("copiaSimple","false");fields.put("copiaCertificada","false");fields.put("tiposDocumento","SOLICITUD_ORIGINAL");
        ByteArrayOutputStream body=new ByteArrayOutputStream();
        for(var entry:fields.entrySet())body.write(("--YAIKU-SYNTHETIC\r\nContent-Disposition: form-data; name=\""+entry.getKey()+"\"\r\n\r\n"+entry.getValue()+"\r\n").getBytes(StandardCharsets.UTF_8));
        body.write("--YAIKU-SYNTHETIC\r\nContent-Disposition: form-data; name=\"archivos\"; filename=\"a.pdf\"\r\nContent-Type: application/pdf\r\n\r\n".getBytes(StandardCharsets.UTF_8));
        body.write(PDF);body.write("\r\n--YAIKU-SYNTHETIC--\r\n".getBytes(StandardCharsets.UTF_8));return body.toByteArray();
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void concurrenciaHttpMismaOperacionNoDuplicaYCambioIncompatibleSeRechaza(boolean incompatible) throws Exception {
        String key=UUID.randomUUID().toString();byte[] one=cuerpoHttp(key,"Pedido sintético"),two=cuerpoHttp(key,incompatible?"Otro pedido":"Pedido sintético");
        try(var executor=Executors.newFixedThreadPool(3)) {
            CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1);
            var holder=executor.submit(()->new TransactionTemplate(manager).execute(tx->{
                jdbc.execute("select pg_advisory_xact_lock(1396787536, 1)");held.countDown();
                try{if(!release.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Timeout sintético");}
                catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}return null;
            }));
            assertThat(held.await(10,TimeUnit.SECONDS)).isTrue();
            java.util.function.Function<byte[],HttpResponse<String>> send=bytes->{try{return HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+base())).header("Authorization","Bearer "+token)
                    .header("Content-Type","multipart/form-data; boundary=YAIKU-SYNTHETIC").POST(HttpRequest.BodyPublishers.ofByteArray(bytes)).build(),HttpResponse.BodyHandlers.ofString());
            }catch(Exception e){throw new IllegalStateException(e);}};
            var a=executor.submit(()->send.apply(one));var b=executor.submit(()->send.apply(two));
            try{long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(12),waiting=0;while(System.nanoTime()<end){
                waiting=jdbc.queryForObject("select count(distinct pid) from pg_stat_activity where datname=current_database() and wait_event_type='Lock'",Long.class);
                if(waiting>=2)break;Thread.sleep(20);}assertThat(waiting).isGreaterThanOrEqualTo(2);
            }finally{release.countDown();}
            holder.get(15,TimeUnit.SECONDS);var ra=a.get(20,TimeUnit.SECONDS);var rb=b.get(20,TimeUnit.SECONDS);
            assertThat(List.of(ra.statusCode(),rb.statusCode())).containsExactlyInAnyOrder(200,incompatible?409:200);
            if(!incompatible)assertThat(json.readTree(ra.body()).path("id").asLong()).isEqualTo(json.readTree(rb.body()).path("id").asLong());
        }
        assertThat(cuenta("solicitudes")).isEqualTo(1);assertThat(cuenta("documentos")).isEqualTo(1);
        assertThat(cuenta("recepciones_alta_saip")).isEqualTo(1);assertThat(archivos()).isEqualTo(1);assertThat(cuenta("intentos_notificacion")).isZero();
    }
    @Test void documentoAsociadoAOtraSolicitudNoSeAtribuyeALaRecepcion() throws Exception {
        String key=UUID.randomUUID().toString();JsonNode r=json.readTree(mvc.perform(envio(key,pdf("a.pdf"))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode other=json.readTree(mvc.perform(envio(UUID.randomUUID().toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        jdbc.update("update documentos set id_solicitud=? where id_documento=?",other.path("solicitud").path("id").asLong(),r.path("documentos").get(0).path("id").asLong());
        mvc.perform(get(base()+"/"+key).header("Authorization","Bearer "+token)).andExpect(status().isConflict());assertThat(cuenta("solicitudes")).isEqualTo(2);
    }
    @Test void flywayValidateYContratoRealCompleto() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();assertThat(flyway.info().pending()).isEmpty();
        assertThat(Arrays.stream(flyway.info().applied()).anyMatch(m->"11".equals(m.getVersion().toString()))).isTrue();
        String dir=System.getenv("ALTA_SAIP_POSTGRES_ARTIFACTS");if(dir!=null){
            var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);Files.writeString(Path.of(dir,"openapi-alta-saip.json"),response.body());
            Files.writeString(Path.of(dir,"flyway-alta-saip.txt"),Arrays.toString(Arrays.stream(flyway.info().applied()).map(m->m.getVersion()+" "+m.getDescription()+" "+m.getChecksum()).toArray()));
        }
    }
    @TestConfiguration static class DescartarConfirmacion {
        @Bean Filter descartarAlta(){return (request,response,chain)->{chain.doFilter(request,response);
            if("true".equals(((HttpServletRequest)request).getHeader("X-Sintetico-Descartar")))throw new IOException("Confirmación descartada tras commit, solo prueba");};}
    }

    @Test void dosAltasDistintasConcurrentesNoColisionanEnNumeracion() throws Exception {
        jdbc.execute("CREATE FUNCTION alta_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(987654321::bigint); RETURN NEW; END $$");
        jdbc.execute("CREATE TRIGGER alta_gate BEFORE INSERT ON solicitudes FOR EACH ROW EXECUTE FUNCTION alta_gate()");
        try(var executor=Executors.newFixedThreadPool(3)) {
            CountDownLatch held=new CountDownLatch(1), release=new CountDownLatch(1);
            var holder=executor.submit(()->new TransactionTemplate(manager).execute(tx->{
                jdbc.execute("select pg_advisory_xact_lock(987654321::bigint)"); held.countDown();
                try{if(!release.await(20,TimeUnit.SECONDS))throw new IllegalStateException("Timeout sintético");}
                catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);} return null;
            }));
            assertThat(held.await(10,TimeUnit.SECONDS)).isTrue();
            String body=json.writeValueAsString(Map.of("ciudadanoId",ciudadanoId,"entidadId",entidadId,"asunto","Pedido concurrente sintético",
                "descripcion","Información sintética solicitada","consentimientoDatosPersonales",true,"canalNotificacion","CORREO_ELECTRONICO","formatoDigital",true));
            Callable<Integer> send=()->HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/solicitudes"))
                .header("Authorization","Bearer "+token).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.discarding()).statusCode();
            var a=executor.submit(send); var b=executor.submit(send);
            try {
                long end=System.nanoTime()+TimeUnit.SECONDS.toNanos(12), waiting=0;
                while(System.nanoTime()<end){waiting=jdbc.queryForObject("select count(distinct pid) from pg_stat_activity where datname=current_database() and wait_event_type='Lock'",Long.class);
                    if(waiting>=2)break;Thread.sleep(20);}
                assertThat(waiting).as("independent concurrent PostgreSQL connections").isGreaterThanOrEqualTo(2);
            } finally {release.countDown();}
            holder.get(15,TimeUnit.SECONDS);
            assertThat(List.of(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS))).containsExactly(201,201);
        } finally {jdbc.execute("DROP TRIGGER alta_gate ON solicitudes");jdbc.execute("DROP FUNCTION alta_gate()");}
        assertThat(cuenta("solicitudes")).isEqualTo(2);
    }
}
