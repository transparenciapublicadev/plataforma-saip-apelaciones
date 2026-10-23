package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import pe.gob.saip.backend.model.entity.*;
import pe.gob.saip.backend.model.dto.*;
import pe.gob.saip.backend.service.*;
import pe.gob.saip.backend.repository.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Real PostgreSQL/Flyway/JPA/JWT/LOCAL. No persistence, storage or authentication mocks. */
@EnabledIfEnvironmentVariable(named="RUN_TTAIP_POSTGRES_TESTS", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "server.address=127.0.0.1", "spring.flyway.enabled=true",
    "springdoc.default-produces-media-type=application/json",
    "springdoc.default-consumes-media-type=application/json",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed",
    "spring.flyway.clean-disabled=true", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class SubsanacionTtaipPostgresIntegrationTest {
    private static final byte[] PDF = "%PDF-1.4\nSubsanacion sintetica\n%%EOF".getBytes(StandardCharsets.UTF_8);
    private static final Path ROOT = crearDirectorio();
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    @Autowired PasswordEncoder encoder;
    @Autowired PlatformTransactionManager manager;
    @Autowired CiudadanoRepository ciudadanos;
    @Autowired UsuarioRepository usuarios;
    @Autowired ApelacionRepository apelaciones;
    @Autowired ResolucionRepository resoluciones;
    @Autowired SalaTtaipRepository salas;
    @Autowired Flyway flyway;
    @Autowired ExpedienteTtaipService expedientes;
    @Autowired SubsanacionTtaipService subsanaciones;
    @Autowired TTAIPService ttaip;
    @Autowired NotificacionTtaipRepository notificaciones;
    @Autowired CedulaNotificacionRepository cedulas;
    @LocalServerPort int port;
    private Long apId, reqId;
    private String token, otroToken, clave;

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry r) {
        String url = System.getenv("TTAIP_POSTGRES_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/yaiku_e11_closeout_[a-f0-9]{32}"))
            throw new IllegalArgumentException("Solo base temporal propia de pruebas en loopback");
        r.add("spring.datasource.url", () -> url);
        r.add("spring.datasource.username", () -> "yaiku_e11_test");
        r.add("spring.datasource.password", () -> "");
        r.add("app.storage.local.base-path", () -> ROOT.resolve("documents").toString());
    }
    static Path crearDirectorio() {
        try { return Files.createTempDirectory("yaiku-ttaip-recepcion-"); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    @AfterAll
    static void limpiarAlmacenamientoPropio() throws Exception {
        Path temp = Path.of(System.getProperty("java.io.tmpdir")).toAbsolutePath().normalize();
        Path owned = ROOT.toAbsolutePath().normalize();
        if (!owned.getParent().equals(temp) || !owned.getFileName().toString().startsWith("yaiku-ttaip-recepcion-"))
            throw new IllegalStateException("Ruta temporal fuera del alcance de la prueba");
        if (Files.exists(owned)) {
            try (var walk = Files.walk(owned)) {
                for (Path path : walk.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
            }
        }
    }
    @BeforeEach
    void preparar() throws Exception {
        jdbc.execute("TRUNCATE usuarios, entidades, salas_ttaip RESTART IDENTITY CASCADE");
        if (Files.exists(ROOT.resolve("documents"))) {
            try (var walk = Files.walk(ROOT.resolve("documents"))) {
                for (Path path : walk.sorted(Comparator.reverseOrder()).toList()) Files.delete(path);
            }
        }
        Files.createDirectories(ROOT.resolve("documents"));
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            Ciudadano owner = ciudadano("propietario@example.invalid", "00000001");
            ciudadano("otro@example.invalid", "00000002");
            SalaTtaip sala = new SalaTtaip(); sala.setNombre("Sala sintética");
            sala.setPeriodoInicio(LocalDate.now().minusYears(1)); sala.setPeriodoFin(LocalDate.now().plusYears(1));
            salas.saveAndFlush(sala);
            Apelacion ap = new Apelacion(); ap.setExpediente("00001-2026-JUS/TTAIP");
            ap.setCiudadano(owner); ap.setFundamentos("Fundamentos originales");
            ap.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA); ap.setEntidadExternaNombre("Entidad sintética");
            ap.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION); ap.setFechaSubsanacion(LocalDate.now()); ap.setDiasSubsanacion(2);
            ap = apelaciones.saveAndFlush(ap); apId = ap.getId();
            reqId = requerimiento(ap).getId();
        });
        token = login("propietario@example.invalid"); otroToken = login("otro@example.invalid");
        clave = UUID.randomUUID().toString();
    }
    Ciudadano ciudadano(String email, String dni) {
        Ciudadano c = new Ciudadano(); c.setEmail(email); c.setPassword(encoder.encode("Sintetico-2026!"));
        c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO); c.setNombreCompleto("Persona sintética"); c.setDni(dni);
        return ciudadanos.saveAndFlush(c);
    }
    Resolucion requerimiento(Apelacion ap) {
        Resolucion r = new Resolucion(); r.setApelacion(ap); r.setTipoResolucion(Resolucion.TipoResolucion.PRIMERA_CALIFICACION);
        r.setDecision(Resolucion.DecisionResolucion.INADMISIBLE); r.setFundamentos("Calificación sintética");
        r.setObservaciones("Aclarar el periodo y acompañar el sustento que corresponda");
        return resoluciones.saveAndFlush(r);
    }
    String login(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("identificador",email,"password","Sintetico-2026!"))))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).path("token").asString();
    }
    String base(Long ap, Long req) { return "/api/apelaciones/" + ap + "/subsanacion/" + req + "/recepcion"; }
    MockMultipartFile archivo(String nombre, byte[] bytes) { return new MockMultipartFile("archivos", nombre, "application/pdf", bytes); }
    ResultActions enviar(String key, String texto, String bearer, MockMultipartFile... files) throws Exception {
        var request = multipart(base(apId,reqId)).param("claveOperacion",key).param("fundamentosAdicionales",texto);
        for (var file : files) request.file(file);
        return mvc.perform(request.header("Authorization","Bearer " + bearer));
    }
    JsonNode recibir() throws Exception {
        return json.readTree(enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }
    long archivosFisicos() throws Exception {
        try (var stream=Files.walk(ROOT.resolve("documents"))) { return stream.filter(Files::isRegularFile).count(); }
    }
    void sinRecepcion() throws Exception {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM recepciones_subsanacion_ttaip",Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM documentos",Long.class)).isZero();
        assertThat(archivosFisicos()).isZero();
        assertThat(apelaciones.findById(apId).orElseThrow().getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_SUBSANACION);
    }
    @Test void sinEvidenciaNoUsaLaCreacionComoInicio() throws Exception {
        jdbc.update("update apelaciones set fecha_subsanacion=? where id_apelacion=?",LocalDate.now().minusDays(20),apId);
        mvc.perform(get("/api/apelaciones/"+apId+"/subsanacion/requerimiento").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.fechaBasePlazo").isEmpty())
                .andExpect(jsonPath("$.admitePresentacion").value(true));
    }
    record DatosNotificacion(Long expedienteId, Long id, String cedula) {}
    DatosNotificacion notificacion(Long requerimiento) {
        // Synthetic fixture creation date is deliberately different from delivery evidence.
        jdbc.update("update resoluciones set fecha_resolucion=? where id_resolucion=?",LocalDateTime.now().minusDays(30),requerimiento);
        return new TransactionTemplate(manager).execute(status -> {
            Resolucion r=resoluciones.findById(requerimiento).orElseThrow();
            expedientes.prepararResolucion(r); resoluciones.saveAndFlush(r); expedientes.registrarResolucion(r);
            NotificacionTtaip n=notificaciones.findByCedula_Resolucion_IdResolucionAndDestinatarioOrderByFechaNotificacionDesc(
                    requerimiento,CedulaNotificacion.DestinatarioNotificacion.CIUDADANO).getFirst();
            return new DatosNotificacion(n.getExpediente().getId(),n.getId(),n.getCedula().getNumeroCedula());
        });
    }
    void validar(DatosNotificacion n, LocalDateTime fechaEficaz) {
        expedientes.validarNotificacionManualmente(n.expedienteId(),n.id(),new ValidarNotificacionManualRequest(
                LocalDateTime.now(),"Operador sintético","Cargo acreditado de entrega al recurrente",null,"CARGO-SINTETICO",fechaEficaz));
    }
    void acuse(DatosNotificacion n, String estado, LocalDateTime fecha) {
        expedientes.registrarAcuseAutomatico(n.expedienteId(),n.id(),new RegistrarAcuseAutomaticoNotificacionRequest(
                estado,"Acuse sintético de entrega",fecha,null,null,"ACUSE-SINTETICO","Operador sintético",null));
    }
    ResultActions consultarPlazo() throws Exception {
        return mvc.perform(get("/api/apelaciones/"+apId+"/subsanacion/requerimiento").header("Authorization","Bearer "+token))
                .andExpect(status().isOk());
    }
    void pendiente() throws Exception {
        consultarPlazo().andExpect(jsonPath("$.plazo.estado").value("PENDIENTE_INICIO"))
                .andExpect(jsonPath("$.fechaLimite").isEmpty()).andExpect(jsonPath("$.diasHabilesRestantes").isEmpty())
                .andExpect(jsonPath("$.admitePresentacion").value(true));
        assertThat(subsanaciones.procesarVencidas()).isZero();
        assertThat(jdbc.queryForObject("select estado from apelaciones where id_apelacion=?",String.class,apId)).isEqualTo("EN_SUBSANACION");
    }
    @Test void sinRequerimientoNoPublicaUnRelojFicticioEnLosDtosDeApelacion() throws Exception {
        jdbc.update("delete from resoluciones where id_resolucion=?",reqId);
        jdbc.update("update apelaciones set estado='EN_CALIFICACION_1' where id_apelacion=?",apId);
        String body=mvc.perform(get("/api/apelaciones/"+apId).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(json.readTree(body).has("plazoSubsanacion")).isFalse();
        new TransactionTemplate(manager).executeWithoutResult(status -> {
            var info=ApelacionInfoDTO.from(apelaciones.findById(apId).orElseThrow());
            assertThat(json.readTree(json.writeValueAsString(info)).has("plazoSubsanacion")).isFalse();
        });
    }
    @Test void estadosPendienteFallidaYObservadaNoInicianNiVencen() throws Exception {
        DatosNotificacion n=notificacion(reqId); pendiente();
        for(String estado:List.of("FALLIDO","NO_RECIBIDO","OBSERVADO")) {
            acuse(n,estado,LocalDateTime.now().minusDays(20)); pendiente();
        }
        assertThat(jdbc.queryForObject("select count(*) from inicios_plazo_subsanacion_ttaip",Long.class)).isZero();
        recibir();
    }
    @Test void envioTecnicoYEstadosHistoricosSinEvidenciaNoFabricanFecha() throws Exception {
        DatosNotificacion n=notificacion(reqId);
        expedientes.registrarConstanciaEnvio(n.expedienteId(),n.id(),new RegistrarConstanciaEnvioNotificacionRequest(
                "CORREO_ELECTRONICO",LocalDateTime.now().minusDays(20),null,null,"SMTP aceptó el envío",null,null,"Operador",null));
        pendiente();
        jdbc.update("update notificaciones_ttaip set estado='ENTREGADA', estado_acuse='ENTREGADO', acuse_automatico='Estado técnico histórico', fecha_acuse=? where id_notificacion=?",
                LocalDateTime.now().minusDays(19),n.id());
        pendiente(); validar(n,null); pendiente(); acuse(n,"ENTREGADO",null); pendiente();
        assertThat(jdbc.queryForObject("select fecha_subsanacion from apelaciones where id_apelacion=?",LocalDate.class,apId)).isEqualTo(LocalDate.now());
    }
    @Test void acuseCorreoExigeConstanciaYFechaExplicita() throws Exception {
        DatosNotificacion n=notificacion(reqId);
        jdbc.update("update notificaciones_ttaip set medio='CORREO_ELECTRONICO', medio_notificacion='CORREO_ELECTRONICO' where id_notificacion=?",n.id());
        acuse(n,"ENTREGADO",LocalDateTime.now().minusHours(1)); pendiente();
        expedientes.registrarConstanciaEnvio(n.expedienteId(),n.id(),new RegistrarConstanciaEnvioNotificacionRequest(
                "CORREO_ELECTRONICO",LocalDateTime.now().minusHours(2),null,null,"Constancia sintética",null,null,"Operador",null));
        LocalDateTime eficaz=LocalDateTime.now().minusHours(1).withNano(0); acuse(n,"ENTREGADO",eficaz);
        consultarPlazo().andExpect(jsonPath("$.plazo.estado").value("EN_CURSO"))
                .andExpect(jsonPath("$.plazo.fuente").value("ACUSE_ENTREGADO"))
                .andExpect(jsonPath("$.fechaBasePlazo").value(eficaz.toLocalDate().toString()));
    }
    @Test void validacionFechadaDifiereDeCreacionYSeComparteEnConsultasYRecepcion() throws Exception {
        DatosNotificacion n=notificacion(reqId); LocalDateTime eficaz=LocalDateTime.now().minusHours(1).withNano(0); validar(n,eficaz);
        String limite=pe.gob.saip.backend.util.DiasHabilesUtil.sumarDiasHabiles(eficaz.toLocalDate(),2).toString();
        consultarPlazo().andExpect(jsonPath("$.plazo.notificacionId").value(n.id()))
                .andExpect(jsonPath("$.fechaBasePlazo").value(eficaz.toLocalDate().toString())).andExpect(jsonPath("$.fechaLimite").value(limite));
        mvc.perform(get("/api/apelaciones/"+apId).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.plazoSubsanacion.fechaLimite").value(limite));
        assertThat(subsanaciones.procesarVencidas()).isZero(); recibir();
        enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isOk());
    }
    @Test void evidenciaDeOtroRequerimientoODestinatarioNoIniciaElActual() throws Exception {
        DatosNotificacion actual=notificacion(reqId);
        Long anterior=new TransactionTemplate(manager).execute(status -> requerimiento(apelaciones.findById(apId).orElseThrow()).getId());
        DatosNotificacion otro=notificacion(anterior);
        jdbc.update("update resoluciones set fecha_resolucion=? where id_resolucion=?",LocalDateTime.now().minusDays(40),anterior);
        validar(otro,LocalDateTime.now().minusDays(15)); pendiente();
        DatosNotificacion entidad=new TransactionTemplate(manager).execute(status -> {
            NotificacionTtaip original=notificaciones.findById(actual.id()).orElseThrow();
            CedulaNotificacion c=new CedulaNotificacion(); c.setResolucion(original.getCedula().getResolucion());
            c.setDestinatario(CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA); c.setNumeroCedula("ENTIDAD-SINTETICA"); cedulas.saveAndFlush(c);
            NotificacionTtaip n=new NotificacionTtaip(); n.setCedula(c); n.setExpediente(original.getExpediente());
            n.setDestinatario(CedulaNotificacion.DestinatarioNotificacion.ENTIDAD_PUBLICA); n.setEstado("PENDIENTE"); notificaciones.saveAndFlush(n);
            return new DatosNotificacion(n.getExpediente().getId(),n.getId(),c.getNumeroCedula());
        });
        validar(entidad,LocalDateTime.now().minusDays(15)); pendiente();
        assertThat(jdbc.queryForObject("select count(*) from inicios_plazo_subsanacion_ttaip where id_requerimiento=?",Long.class,reqId)).isZero();
    }
    @Test void reenvioReprocesoYNuevaValidacionNoAmplianElPlazo() throws Exception {
        DatosNotificacion n=notificacion(reqId); LocalDateTime original=LocalDateTime.now().minusDays(15).withNano(0); validar(n,original);
        String limite=pe.gob.saip.backend.util.DiasHabilesUtil.sumarDiasHabiles(original.toLocalDate(),2).toString();
        expedientes.registrarConstanciaEnvio(n.expedienteId(),n.id(),new RegistrarConstanciaEnvioNotificacionRequest(
                "CASILLA_ELECTRONICA",null,null,null,"Reenvío sintético",null,null,"Operador",null));
        validar(n,LocalDateTime.now().minusHours(1));
        DatosNotificacion nueva=new TransactionTemplate(manager).execute(status -> {
            ReprocesoNotificacion reproceso=expedientes.reprocesarNotificacionFallida(n.cedula(),
                    CedulaNotificacion.DestinatarioNotificacion.CIUDADANO,"Reproceso sintético","Operador");
            NotificacionTtaip nn=reproceso.getNotificacionNueva();
            return new DatosNotificacion(nn.getExpediente().getId(),nn.getId(),nn.getCedula().getNumeroCedula());
        });
        validar(nueva,LocalDateTime.now().minusHours(1));
        consultarPlazo().andExpect(jsonPath("$.plazo.estado").value("VENCIDO"))
                .andExpect(jsonPath("$.plazo.notificacionId").value(n.id())).andExpect(jsonPath("$.fechaLimite").value(limite));
        assertThat(jdbc.queryForObject("select count(*) from inicios_plazo_subsanacion_ttaip",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from reprocesos_notificacion",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select trazabilidad from notificaciones_ttaip where id_notificacion=?",String.class,nueva.id())).contains("existente conservado");
        enviar(clave,"Correcciones",token).andExpect(status().isUnprocessableEntity());
    }
    @Test void automatizacionSoloVenceConInicioAcreditadoYNoCierraPendientes() throws Exception {
        DatosNotificacion n=notificacion(reqId); pendiente(); validar(n,LocalDateTime.now().minusDays(15));
        assertThat(subsanaciones.procesarVencidas()).isEqualTo(1); assertThat(subsanaciones.procesarVencidas()).isEqualTo(1);
        assertThat(jdbc.queryForObject("select estado from apelaciones where id_apelacion=?",String.class,apId)).isEqualTo("EN_SUBSANACION");
    }
    @Test void cierreManualNoPuedeSuplirLaNotificacionEficaz() throws Exception {
        Usuario operador = new Usuario(); operador.setEmail("tribunal@example.invalid");
        operador.setPassword(encoder.encode("Sintetico-2026!")); operador.setTipoUsuario(Usuario.TipoUsuario.TTAIP);
        usuarios.saveAndFlush(operador);
        mvc.perform(post("/api/ttaip/calificacion/"+apId+"/no-presentado")
                .header("Authorization","Bearer "+login("tribunal@example.invalid"))
                .contentType("application/json").content("{\"fundamentos\":\"Cierre sintético solicitado\"}"))
                .andExpect(status().isConflict());
    }
    @Test void dosEvidenciasConcurrentesConservanUnSoloInicio() throws Exception {
        DatosNotificacion n=notificacion(reqId); LocalDateTime eficaz=LocalDateTime.now().minusHours(1).withNano(0);
        CountDownLatch ready=new CountDownLatch(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Void> op=() -> { ready.countDown(); assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); validar(n,eficaz); return null; };
            var a=pool.submit(op); var b=pool.submit(op); a.get(30,TimeUnit.SECONDS); b.get(30,TimeUnit.SECONDS);
        }
        assertThat(jdbc.queryForObject("select count(*) from inicios_plazo_subsanacion_ttaip",Long.class)).isEqualTo(1);
        consultarPlazo().andExpect(jsonPath("$.plazo.estado").value("EN_CURSO"));
    }
    @Test void recibeYRecuperaRecepcionArchivosBytesYHash() throws Exception {
        JsonNode recibida=recibir(); long docId=recibida.path("documentos").get(0).path("id").asLong();
        assertThat(recibida.path("id").asLong()).isPositive();
        assertThat(recibida.path("requerimientoId").asLong()).isEqualTo(reqId);
        assertThat(recibida.path("documentos").get(0).path("apelacionId").asLong()).isEqualTo(apId);
        assertThat(recibida.path("documentos").get(0).path("hashSha256").asString())
                .isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(PDF)));
        mvc.perform(get(base(apId,reqId)+"/"+clave).header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(content().json(recibida.toString()));
        mvc.perform(get("/api/documentos/"+docId+"/download").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(content().bytes(PDF));
        assertThat(apelaciones.findById(apId).orElseThrow().getEstado()).isEqualTo(Apelacion.EstadoApelacion.EN_CALIFICACION_2);
    }
    @Test void recibeTodosLosAdjuntosSeleccionados() throws Exception {
        MockMultipartFile texto=new MockMultipartFile("archivos","aclaracion.txt","text/plain","Aclaración sintética".getBytes(StandardCharsets.UTF_8));
        JsonNode r=json.readTree(enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF),texto)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(r.path("documentos").size()).isEqualTo(2);
        for(int i=0;i<2;i++) {
            byte[] esperado=i==0?PDF:texto.getBytes();
            mvc.perform(get("/api/documentos/"+r.path("documentos").get(i).path("id").asLong()+"/download")
                    .header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(content().bytes(esperado));
        }
        assertThat(archivosFisicos()).isEqualTo(2);
    }
    @Test void rechazaElIdDeUnDocumentoRealAsociadoAOtraApelacion() throws Exception {
        Long apAjena=new TransactionTemplate(manager).execute(status -> {
            Apelacion ap=new Apelacion(); ap.setExpediente("00002-2026-JUS/TTAIP"); ap.setFundamentos("Otra apelación");
            ap.setCiudadano(ciudadanos.findAll().stream().filter(c -> c.getEmail().equals("otro@example.invalid")).findFirst().orElseThrow());
            ap.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION); return apelaciones.saveAndFlush(ap).getId();
        });
        MvcResult upload=mvc.perform(multipart("/api/documentos/upload")
                .file(new MockMultipartFile("file","ajeno.pdf","application/pdf",PDF))
                .param("tipoDocumento","SUBSANACION").param("apelacionId",apAjena.toString())
                .header("Authorization","Bearer "+otroToken)).andExpect(status().isCreated()).andReturn();
        Long docAjeno=json.readTree(upload.getResponse().getContentAsString()).path("id").asLong();
        mvc.perform(multipart(base(apId,reqId)).param("claveOperacion",clave).param("fundamentosAdicionales","Correcciones")
                .param("documentoId",docAjeno.toString()).header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isZero();
        assertThat(jdbc.queryForObject("select id_apelacion from documentos where id_documento=?",Long.class,docAjeno)).isEqualTo(apAjena);
    }
    @Test void requerimientoVigenteNoSeDeduceDelPrimeroDeLaColeccion() throws Exception {
        Long anterior=reqId;
        Long vigente=new TransactionTemplate(manager).execute(status -> requerimiento(apelaciones.findById(apId).orElseThrow()).getId());
        mvc.perform(get("/api/apelaciones/"+apId+"/subsanacion/requerimiento").header("Authorization","Bearer "+token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requerimientoId").value(vigente));
        reqId=anterior; enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isConflict());
        sinRecepcion();
    }
    @Test void reintentoIdenticoNoDuplicaYConflictoNoModifica() throws Exception {
        JsonNode primera=recibir(); long eventos=jdbc.queryForObject("SELECT count(*) FROM historial_ttaip",Long.class);
        enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isOk()).andExpect(content().json(primera.toString()));
        enviar(clave,"Otro contenido",token,archivo("sustento.pdf",PDF)).andExpect(status().isConflict());
        enviar(UUID.randomUUID().toString(),"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM documentos",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM historial_ttaip",Long.class)).isEqualTo(eventos);
        assertThat(archivosFisicos()).isEqualTo(1);
    }
    @Test void falloDelSegundoAdjuntoCompensaElPrimeroYNoAvanza() throws Exception {
        enviar(clave,"Correcciones",token,archivo("primero.pdf",PDF),archivo("segundo.exe",PDF)).andExpect(status().isBadRequest());
        sinRecepcion();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM historial_ttaip",Long.class)).isZero();
        mvc.perform(get(base(apId,reqId)+"/"+clave).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        recibir();
    }
    @Test void falloFisicoLocalNoPresentaNiPersiste() throws Exception {
        Path storage=ROOT.resolve("documents"); Files.delete(storage); Files.writeString(storage,"bloqueo físico de prueba");
        try { enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().is5xxServerError()); }
        finally { Files.delete(storage); Files.createDirectories(storage); }
        sinRecepcion();
    }
    @Test void falloRealPostgresPosteriorALaSubidaRevierteYCompensa() throws Exception {
        jdbc.execute("ALTER TABLE recepciones_subsanacion_ttaip ADD CONSTRAINT fallo_prueba CHECK (fundamentos <> 'Correcciones')");
        try { enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isConflict()); }
        finally { jdbc.execute("ALTER TABLE recepciones_subsanacion_ttaip DROP CONSTRAINT fallo_prueba"); }
        sinRecepcion();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM historial_ttaip",Long.class)).isZero();
        recibir();
    }
    @Test void concurrenciaUsaConexionesYTransaccionesIndependientesSinDuplicar() throws Exception {
        Set<Integer> pids=ConcurrentHashMap.newKeySet(); Set<Long> txids=ConcurrentHashMap.newKeySet();
        CountDownLatch lista=new CountDownLatch(2);
        try (var pool=Executors.newFixedThreadPool(2)) {
            Callable<String> operation=() -> {
                TransactionTemplate tx=new TransactionTemplate(manager); tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                return tx.execute(status -> {
                    pids.add(jdbc.queryForObject("select pg_backend_pid()",Integer.class));
                    txids.add(jdbc.queryForObject("select txid_current()",Long.class)); lista.countDown();
                    try {
                        assertThat(lista.await(10,TimeUnit.SECONDS)).isTrue();
                        return enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isOk())
                                .andReturn().getResponse().getContentAsString();
                    } catch(Exception e) { throw new IllegalStateException(e); }
                });
            };
            var a=pool.submit(operation); var b=pool.submit(operation);
            assertThat(json.readTree(a.get(30,TimeUnit.SECONDS))).isEqualTo(json.readTree(b.get(30,TimeUnit.SECONDS)));
        }
        assertThat(pids).hasSize(2); assertThat(txids).hasSize(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM documentos",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM historial_ttaip WHERE tipo_evento='SUBSANACION'",Long.class)).isEqualTo(1);
        assertThat(archivosFisicos()).isEqualTo(1);
        Files.writeString(artefactos().resolve("concurrencia.txt"),"PostgreSQL PIDs="+pids+" txids="+txids);
    }
    @Test void otroCiudadanoNoPuedePresentarConsultarNiDescargar() throws Exception {
        enviar(clave,"Correcciones",otroToken,archivo("sustento.pdf",PDF)).andExpect(status().isForbidden());
        JsonNode r=recibir();
        mvc.perform(get(base(apId,reqId)+"/"+clave).header("Authorization","Bearer "+otroToken)).andExpect(status().isForbidden());
        mvc.perform(get("/api/documentos/"+r.path("documentos").get(0).path("id").asLong()+"/download")
                .header("Authorization","Bearer "+otroToken)).andExpect(status().isForbidden());
    }
    @Test void noAceptaIdentificadoresDeDocumentosNiRequerimientoAjeno() throws Exception {
        mvc.perform(multipart(base(apId,reqId)).param("claveOperacion",clave).param("fundamentosAdicionales","Correcciones")
                .param("documentoId","123").header("Authorization","Bearer "+token)).andExpect(status().isBadRequest());
        Long ajeno=new TransactionTemplate(manager).execute(status -> {
            Apelacion ap=new Apelacion(); ap.setExpediente("00002-2026-JUS/TTAIP");
            ap.setCiudadano(ciudadanos.findById(apelaciones.findById(apId).orElseThrow().getCiudadano().getId()).orElseThrow());
            ap.setFundamentos("Otro recurso"); ap.setTipoOrigen(Apelacion.TipoOrigenApelacion.EXTERNA);
            ap=apelaciones.saveAndFlush(ap); return requerimiento(ap).getId();
        });
        mvc.perform(multipart(base(apId,ajeno)).param("claveOperacion",clave).param("fundamentosAdicionales","Correcciones")
                .file(archivo("sustento.pdf",PDF)).header("Authorization","Bearer "+token)).andExpect(status().isNotFound());
        sinRecepcion();
    }
    @Test void condicionesVigentesEstadoPlazoYTexto() throws Exception {
        enviar(clave," ",token).andExpect(status().isBadRequest());
        jdbc.update("update apelaciones set estado='EN_RESOLUCION' where id_apelacion=?",apId);
        enviar(clave,"Correcciones",token).andExpect(status().isConflict());
        jdbc.update("update apelaciones set estado='EN_SUBSANACION', fecha_subsanacion=? where id_apelacion=?",LocalDate.now().minusDays(15),apId);
        DatosNotificacion n = notificacion(reqId);
        validar(n, LocalDateTime.now().minusDays(15));
        enviar(clave,"Correcciones",token).andExpect(status().isUnprocessableEntity());
        assertThat(jdbc.queryForObject("select estado from apelaciones where id_apelacion=?",String.class,apId)).isEqualTo("EN_SUBSANACION");
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isZero();
        assertThat(archivosFisicos()).isZero();
    }
    @Test void dosRequerimientosDistintosPuedenTenerRecepcionesEnLaMismaApelacion() throws Exception {
        recibir(); Long primera=reqId;
        reqId=new TransactionTemplate(manager).execute(status -> {
            Apelacion ap=apelaciones.findById(apId).orElseThrow(); ap.setEstado(Apelacion.EstadoApelacion.EN_SUBSANACION);
            ap.setFechaSubsanacion(LocalDate.now()); return requerimiento(ap).getId();
        });
        enviar(UUID.randomUUID().toString(),"Segunda actuación",token,archivo("segundo.pdf",PDF)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isEqualTo(2);
        mvc.perform(get(base(apId,primera)+"/"+clave).header("Authorization","Bearer "+token)).andExpect(status().isOk());
    }
    @Test void legacyConservaJsonYReintentaSinDuplicar() throws Exception {
        String body=json.writeValueAsString(Map.of("fundamentosAdicionales","Texto compatible Android"));
        for(int i=0;i<2;i++) mvc.perform(post("/api/apelaciones/"+apId+"/subsanacion").contentType("application/json")
                .content(body).header("Authorization","Bearer "+token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(apId)).andExpect(jsonPath("$.estado").value("EN_CALIFICACION_2"));
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
    }
    @Test void documentoRetiradoNoConvierteUnaRecepcionExistenteEnAusente() throws Exception {
        JsonNode r=recibir();
        jdbc.update("update documentos set estado='ELIMINADO' where id_documento=?",r.path("documentos").get(0).path("id").asLong());
        mvc.perform(get(base(apId,reqId)+"/"+clave).header("Authorization","Bearer "+token))
                .andExpect(status().isInternalServerError());
        enviar(clave,"Correcciones",token,archivo("sustento.pdf",PDF)).andExpect(status().isInternalServerError());
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isEqualTo(1);
    }

    @Test void transporteHttpRealRecibeMultipartYRecuperaLosBytes() throws Exception {
        String boundary = "yaiku-" + UUID.randomUUID();
        var body = new java.io.ByteArrayOutputStream();
        body.write(("--"+boundary+"\r\nContent-Disposition: form-data; name=\"claveOperacion\"\r\n\r\n"+clave+"\r\n"
                +"--"+boundary+"\r\nContent-Disposition: form-data; name=\"fundamentosAdicionales\"\r\n\r\nCorrecciones HTTP\r\n"
                +"--"+boundary+"\r\nContent-Disposition: form-data; name=\"archivos\"; filename=\"sustento.pdf\"\r\n"
                +"Content-Type: application/pdf\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        body.write(PDF); body.write(("\r\n--"+boundary+"--\r\n").getBytes(StandardCharsets.UTF_8));
        String origin="http://127.0.0.1:"+port;
        try(var client=HttpClient.newHttpClient()) {
            var response=client.send(HttpRequest.newBuilder(URI.create(origin+base(apId,reqId)))
                    .header("Authorization","Bearer "+token).header("Content-Type","multipart/form-data; boundary="+boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            assertThat(response.statusCode()).isEqualTo(200);
            JsonNode receipt=json.readTree(response.body());
            var recovered=client.send(HttpRequest.newBuilder(URI.create(origin+base(apId,reqId)+"/"+clave))
                    .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            assertThat(recovered.statusCode()).isEqualTo(200); assertThat(json.readTree(recovered.body())).isEqualTo(receipt);
            var file=client.send(HttpRequest.newBuilder(URI.create(origin+"/api/documentos/"+receipt.path("documentos").get(0).path("id").asLong()+"/download"))
                    .header("Authorization","Bearer "+token).GET().build(),HttpResponse.BodyHandlers.ofByteArray());
            assertThat(file.statusCode()).isEqualTo(200); assertThat(file.body()).isEqualTo(PDF);
        }
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
    }

    @Test void operacionesConcurrentesIncompatiblesSoloRecibenUnaPresentacion() throws Exception {
        var ready = new CountDownLatch(2);
        try(var pool=Executors.newFixedThreadPool(2)) {
            Callable<Integer> operation=() -> {
                ready.countDown(); assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue();
                return enviar(UUID.randomUUID().toString(),"Correcciones",token,archivo("sustento.pdf",PDF))
                        .andReturn().getResponse().getStatus();
            };
            var a=pool.submit(operation); var b=pool.submit(operation);
            assertThat(List.of(a.get(30,TimeUnit.SECONDS),b.get(30,TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,409);
        }
        assertThat(jdbc.queryForObject("select count(*) from recepciones_subsanacion_ttaip",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from documentos",Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from historial_ttaip where tipo_evento='SUBSANACION'",Long.class)).isEqualTo(1);
        assertThat(archivosFisicos()).isEqualTo(1);
    }

    @Test void flywayValidaYExportaContratoCompletoDeInstanciaReal() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(Arrays.stream(flyway.info().applied()).map(m -> m.getVersion().toString()))
                .containsExactly("1","2","3","4","5","6","7","8","9","10");
        Files.writeString(artefactos().resolve("flyway.txt"), jdbc.queryForList("select version,script,checksum,success from flyway_schema_history order by installed_rank").toString());
        try(var client=HttpClient.newHttpClient()) {
            var response=client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            assertThat(response.statusCode()).isEqualTo(200);
            Files.writeString(artefactos().resolve("openapi-real.json"),response.body());
            JsonNode spec=json.readTree(response.body());
            String path="/api/apelaciones/{apelacionId}/subsanacion/{requerimientoId}/recepcion";
            assertThat(spec.path("paths").path(path).path("post").path("responses").path("200")
                    .path("content").path("application/json").path("schema").path("$ref").asString())
                    .isEqualTo("#/components/schemas/SubsanacionTtaipRecepcionDTO");
            assertThat(spec.path("components").path("schemas").path("SubsanacionTtaipRecepcionDTO").path("required").toString())
                    .contains("requerimientoId", "documentos", "fechaRecepcion");
            assertThat(spec.path("components").path("schemas").path("RegistrarSubsanacionTtaipRequest")
                    .path("properties").path("archivos").path("items").path("format").asString()).isEqualTo("binary");
            assertThat(spec.path("security").toString()).contains("bearerAuth");
            JsonNode reloj=spec.path("components").path("schemas").path("PlazoSubsanacionTtaipDTO");
            assertThat(reloj.path("required").toString()).contains("requerimientoId","estado","diasHabiles");
            assertThat(reloj.path("properties").path("fechaEficacia").path("type").toString()).contains("string","null");
            assertThat(reloj.path("properties").path("diasHabilesRestantes").path("type").toString()).contains("integer","null");
            assertThat(spec.path("components").path("schemas").path("ValidarNotificacionManualRequest")
                    .path("required").toString()).doesNotContain("fechaEficacia");
        }
    }
    Path artefactos() throws Exception { Path p=Path.of(System.getenv("TTAIP_POSTGRES_ARTIFACTS")); Files.createDirectories(p); return p; }
}
