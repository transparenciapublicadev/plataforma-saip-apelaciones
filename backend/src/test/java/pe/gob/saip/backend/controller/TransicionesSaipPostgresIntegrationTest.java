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
import pe.gob.saip.backend.util.DiasHabilesUtil;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
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
@EnabledIfEnvironmentVariable(named="RUN_R3_SAIP_POSTGRES_TESTS", matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "server.address=127.0.0.1", "spring.flyway.enabled=true", "spring.flyway.clean-disabled=true",
    "spring.flyway.locations=classpath:db/migration,classpath:db/seed", "spring.jpa.hibernate.ddl-auto=validate",
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect",
    "springdoc.default-produces-media-type=application/json", "springdoc.default-consumes-media-type=application/json",
    "app.storage.provider=local", "app.notifications.mode=MOCK", "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print=org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class TransicionesSaipPostgresIntegrationTest {
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
        String url=System.getenv("SAIP_POSTGRES_URL");
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
        String hash=encoder.encode("Sintetico-2026!");
        new TransactionTemplate(manager).executeWithoutResult(tx->{
            Ciudadano c=ciudadano("persona@example.invalid","00000001",hash); ciudadanoId=c.getId();
            ciudadano("otra@example.invalid","00000002",hash);
            Entidad e=entidad("Entidad sintética","SINT"); entidadId=e.getId();
            Entidad otra=entidad("Otra entidad sintética","OTRA"); otraEntidadId=otra.getId();
            funcionarioId=funcionario("funcionario@example.invalid",hash,e).getId(); funcionario("ajeno@example.invalid",hash,otra);
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
    @Test void ampliacionProgramadaRespetaElLimiteYRegistraEntregasPorSeparado() throws Exception {
        LocalDate hoy = LocalDate.now(pe.gob.saip.backend.config.ClockConfig.ZONA_LIMA);
        String ruta = base() + "/ampliaciones";
        String prevision = ruta + "/prevision";
        mvc.perform(get(prevision).param("diasHabilesAdicionales", "31")
                .header("Authorization", "Bearer " + login("ajeno@example.invalid")))
            .andExpect(status().isForbidden());
        var datos = json.readTree(mvc.perform(get(prevision).param("diasHabilesAdicionales", "31")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.requiereCronograma").value(true))
            .andReturn().getResponse().getContentAsString());
        LocalDate limite = LocalDate.parse(datos.path("fechaLimiteAmpliada").asString());
        var hitos = new ArrayList<Map<String, Object>>();
        for (LocalDate fecha = hoy.plusDays(14); fecha.isBefore(limite); fecha = fecha.plusDays(14)) {
            hitos.add(Map.of("numeroEntrega", hitos.size() + 1, "descripcion", "Bloque parcial", "fechaProgramada", fecha));
        }
        var payload = new HashMap<String, Object>(Map.of("motivoAmpliacion", "Material por digitalizar",
                "informeAmpliacion", "Informe sintético", "fechaNotificacionAmpliacion", hoy,
                "diasHabilesAdicionales", 31, "cronograma", List.of()));
        mvc.perform(post(ruta).header("Authorization", "Bearer " + token).contentType("application/json")
                .content(json.writeValueAsString(payload))).andExpect(status().isBadRequest());
        hitos.add(Map.of("numeroEntrega", hitos.size() + 1, "descripcion", "Bloque final", "fechaProgramada", limite.plusDays(1)));
        payload.put("cronograma", hitos);
        mvc.perform(post(ruta).header("Authorization", "Bearer " + token).contentType("application/json")
                .content(json.writeValueAsString(payload))).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from ampliaciones_plazo_solicitud", Integer.class)).isZero();
        hitos.set(hitos.size() - 1, Map.of("numeroEntrega", hitos.size(), "descripcion", "Bloque final", "fechaProgramada", limite));
        var ampliacion = json.readTree(mvc.perform(post(ruta).header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(payload)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.estadoAmpliacion").value("REGISTRADA"))
            .andExpect(jsonPath("$.fechaLimiteAmpliada").value(limite.toString()))
            .andReturn().getResponse().getContentAsString());
        long idHito = ampliacion.path("cronograma").get(0).path("id").asLong();
        String entrega = ruta + "/" + ampliacion.path("id").asLong() + "/cronograma/" + idHito;
        mvc.perform(get(prevision).param("diasHabilesAdicionales", "31").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.disponible").value(false));
        jdbc.update("update cronograma_entregas_parciales_solicitud set fecha_programada=? where id_entrega=?", hoy.minusDays(1), idHito);
        mvc.perform(get(base()).header("Authorization", "Bearer " + login("persona@example.invalid")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ampliacionesPlazo[0].cronograma[0].incumplida").value(true));
        mvc.perform(patch(entrega).header("Authorization", "Bearer " + token).contentType("application/json")
                .content(json.writeValueAsString(Map.of("estado", "ENTREGADA", "fechaEntregaReal", hoy))))
            .andExpect(status().isBadRequest());
        MockMultipartFile anexo = new MockMultipartFile("archivos", "entrega.txt", "text/plain", new byte[]{65, 66});
        MockMultipartFile indice = new MockMultipartFile("archivos", "indice.txt", "text/plain", new byte[]{67});
        MockMultipartFile vacio = new MockMultipartFile("archivos", "vacio.txt", "text/plain", new byte[]{});
        mvc.perform(multipart(entrega).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        mvc.perform(multipart(entrega).file(anexo).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.plusDays(1).toString())
                .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        mvc.perform(multipart(entrega).file(anexo).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.toString())
                .header("Authorization", "Bearer " + login("ajeno@example.invalid"))).andExpect(status().isForbidden());
        mvc.perform(multipart(entrega).file(anexo).file(vacio).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.toString())
                .header("Authorization", "Bearer " + token)).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from documentos where id_entrega_parcial=?", Integer.class, idHito)).isZero();
        try (var paths = Files.walk(LOCAL)) {
            assertThat(paths.filter(Files::isRegularFile).toList()).isEmpty();
        }
        assertThat(jdbc.queryForObject("select estado from cronograma_entregas_parciales_solicitud where id_entrega=?",
                String.class, idHito)).isEqualTo("PROGRAMADA");

        mvc.perform(multipart(entrega).file(anexo).param("decision", "DENEGACION_TOTAL")
                .param("fechaEntregaReal", hoy.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
        var recepcion = json.readTree(mvc.perform(multipart(entrega).file(anexo).file(indice).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.toString())
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("ENTREGADA"))
            .andExpect(jsonPath("$.incumplida").value(true)).andExpect(jsonPath("$.decision").value("ENTREGA_PARCIAL")).andExpect(jsonPath("$.documentos.length()").value(2))
            .andReturn().getResponse().getContentAsString());
        mvc.perform(multipart(entrega).file(anexo).param("decision", "ENTREGA_PARCIAL").param("fundamentoDecision", "Se excluye la información protegida").param("fechaEntregaReal", hoy.toString())
                .header("Authorization", "Bearer " + token)).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("select count(*) from documentos where id_entrega_parcial=?", Integer.class, idHito)).isEqualTo(2);
        String titular = login("persona@example.invalid");
        mvc.perform(get(base()).header("Authorization", "Bearer " + titular)).andExpect(status().isOk())
            .andExpect(jsonPath("$.ampliacionesPlazo[0].cronograma[0].documentos.length()").value(2))
            .andExpect(jsonPath("$.documentosMetadata").isEmpty());
        for (var documento : recepcion.path("documentos")) {
            String descarga = "/api/documentos/" + documento.path("id").asLong() + "/download";
            byte[] esperado = documento.path("nombreOriginal").asString().equals("entrega.txt") ? anexo.getBytes() : indice.getBytes();
            mvc.perform(get(descarga).header("Authorization", "Bearer " + titular)).andExpect(status().isOk())
                .andExpect(content().bytes(esperado));
            mvc.perform(get(descarga).header("Authorization", "Bearer " + login("otra@example.invalid")))
                .andExpect(status().isForbidden());
        }
        long ampliacionId = ampliacion.path("id").asLong();
        long segundoHito = ampliacion.path("cronograma").get(1).path("id").asLong();
        String denegacion = ruta + "/" + ampliacionId + "/cronograma/" + segundoHito;
        mvc.perform(multipart(denegacion).file(indice).param("decision", "DENEGACION_TOTAL")
                .param("fundamentoDecision", "Se deniega el bloque mediante oficio motivado")
                .param("fechaEntregaReal", hoy.toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.decision").value("DENEGACION_TOTAL"))
            .andExpect(jsonPath("$.incumplida").value(false));

        long tercerHito = ampliacion.path("cronograma").get(2).path("id").asLong();
        String registroAnterior = ruta + "/" + ampliacionId + "/cronograma/" + tercerHito;
        jdbc.update("update cronograma_entregas_parciales_solicitud set estado='ENTREGADA',fecha_entrega_real=? where id_entrega=?",
                hoy.minusDays(1), tercerHito);
        mvc.perform(multipart(registroAnterior).file(indice).param("decision", "ENTREGA_TOTAL")
                .param("fechaEntregaReal", hoy.minusDays(1).toString()).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.decision").value("ENTREGA_TOTAL"))
            .andExpect(jsonPath("$.fechaEntregaReal").value(hoy.minusDays(1).toString()));
        assertThat(jdbc.queryForObject("select count(*) from respuestas", Integer.class)).isZero();
    }

    @ParameterizedTest
    @ValueSource(ints = {2, 5})
    void rechazaCronogramaConMasDeTreintaDiasEntreEntregas(int cantidad) throws Exception {
        String ruta = base() + "/ampliaciones";
        var prevision = json.readTree(mvc.perform(get(ruta + "/prevision").param("diasHabilesAdicionales", "50")
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        LocalDate hoy = LocalDate.parse(prevision.path("hoy").asString());
        LocalDate limite = LocalDate.parse(prevision.path("fechaLimiteAmpliada").asString());
        assertThat(limite).isAfter(hoy.plusDays(cantidad + 30L));
        var hitos = new ArrayList<Map<String, Object>>();
        for (int n = 1; n < cantidad; n++) {
            hitos.add(Map.of("numeroEntrega", n, "descripcion", "Bloque " + n, "fechaProgramada", hoy.plusDays(n)));
        }
        hitos.add(Map.of("numeroEntrega", cantidad, "descripcion", "Último bloque", "fechaProgramada", limite));
        var payload = Map.of("motivoAmpliacion", "Se requiere digitalizar varios expedientes", "informeAmpliacion", "Informe sintético",
                "fechaNotificacionAmpliacion", hoy, "diasHabilesAdicionales", 50, "cronograma", hitos);

        mvc.perform(post(ruta).header("Authorization", "Bearer " + token).contentType("application/json")
                .content(json.writeValueAsString(payload)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("30 días")));
        assertThat(jdbc.queryForObject("select count(*) from cronograma_entregas_parciales_solicitud", Integer.class)).isZero();
    }

    @Test void ampliacionConFechaUnicaConservaLaFechaSinCrearEntregas() throws Exception {
        String ruta = base() + "/ampliaciones";
        var prevision = json.readTree(mvc.perform(get(ruta + "/prevision").param("diasHabilesAdicionales", "5")
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString());
        var datos = Map.of("motivoAmpliacion", "Búsqueda en archivo", "informeAmpliacion", "Informe sintético",
                "fechaNotificacionAmpliacion", prevision.path("hoy").asString(), "diasHabilesAdicionales", 5, "cronograma", List.of());
        var ampliacion = json.readTree(mvc.perform(post(ruta).header("Authorization", "Bearer " + token).contentType("application/json")
                .content(json.writeValueAsString(datos)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.cronograma").isEmpty())
            .andExpect(jsonPath("$.fechaLimiteAmpliada").value(prevision.path("fechaLimiteAmpliada").asString()))
            .andReturn().getResponse().getContentAsString());
        assertThat(jdbc.queryForObject("select count(*) from cronograma_entregas_parciales_solicitud", Integer.class)).isZero();
        LocalDate hoy = LocalDate.parse(prevision.path("hoy").asString());
        long id = ampliacion.path("id").asLong();
        String titular = login("persona@example.invalid");
        jdbc.update("update ampliaciones_plazo_solicitud set fecha_limite_original=? where id_ampliacion=?", hoy, id);
        mvc.perform(get(base()).header("Authorization", "Bearer " + titular)).andExpect(status().isOk())
            .andExpect(jsonPath("$.ampliacionesPlazo[0].plazoOrdinarioVencido").value(false));
        jdbc.update("update ampliaciones_plazo_solicitud set fecha_limite_original=? where id_ampliacion=?", hoy.minusDays(1), id);
        mvc.perform(get(base()).header("Authorization", "Bearer " + titular)).andExpect(status().isOk())
            .andExpect(jsonPath("$.ampliacionesPlazo[0].plazoOrdinarioVencido").value(true));
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

    @ParameterizedTest @ValueSource(strings={"PENDIENTE_INFORMACION","RESPONDIDA","DENEGADA","CONCLUIDA","VENCIDA"})
    void patchNoSustituyeActuaciones(String destino) throws Exception {
        var antes=actuaciones(); mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token)
            .contentType("application/json").content(json.writeValueAsString(Map.of("estado",destino))))
            .andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void revisionOrdinariaYRepeticionNoInventanActuaciones() throws Exception {
        var antes=actuaciones();
        for(int i=0;i<2;i++) mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"estado\":\"EN_REVISION\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("EN_REVISION"));
        assertThat(actuaciones()).isEqualTo(antes);
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"RECEPCIONADA\"}")).andExpect(status().isConflict());
    }
    @Test void putOrdinarioNoPermiteFalsificarEstadoFechasRespuestaNiDocumentos() throws Exception {
        var antes=actuaciones();
        mvc.perform(put(base()).header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"asunto\":\"Edición ordinaria\",\"estado\":\"RESPONDIDA\",\"fechaLimite\":\"2040-01-01\",\"respuesta\":{\"tipoRespuesta\":\"ENTREGA_TOTAL\"},\"documentos\":[{\"id\":999}]}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.asunto").value("Edición ordinaria"))
            .andExpect(jsonPath("$.estado").value("RECEPCIONADA")).andExpect(jsonPath("$.respuesta").isEmpty());
        assertThat(actuaciones()).isEqualTo(antes);
        assertThat(jdbc.queryForObject("select fecha_limite from solicitudes where id_solicitud=?",LocalDate.class,solicitudId)).isNotEqualTo(LocalDate.of(2040,1,1));
    }
    @Test void rechazoPutNoPersisteEdicionParcial() throws Exception {
        mvc.perform(put(base()).header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"asunto\":\"No debe persistir\",\"prioridad\":\"INVENTADA\"}"))
            .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select asunto from solicitudes where id_solicitud=?",String.class,solicitudId)).isEqualTo("Asunto original");
    }
    @ParameterizedTest @ValueSource(strings={"","/aceptar","/denegar"})
    void comandosDeRespuestaNoReabrenSolicitudConcluida(String ruta) throws Exception {
        jdbc.update("update solicitudes set estado='CONCLUIDA' where id_solicitud=?",solicitudId); var antes=actuaciones();
        responder(ruta,ruta.equals("/denegar")?"DENEGACION_TOTAL":"ENTREGA_TOTAL").andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("CONCLUIDA");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void respuestaNoOmiteSubsanacionPendienteNiLaReviveDespuesDeCerrada() throws Exception {
        observar();var antes=actuaciones(); responder("","ENTREGA_TOTAL").andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("PENDIENTE_INFORMACION");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void patchNoAceptaSubsanacionAntesDeSuRecepcion() throws Exception {
        observar();var antes=actuaciones();
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json")
            .content("{\"estado\":\"EN_REVISION\"}")).andExpect(status().isConflict());
        assertThat(actuaciones()).isEqualTo(antes);assertThat(estado()).isEqualTo("PENDIENTE_INFORMACION");
    }
    @Test void rutaDocumentalInexistenteNoAcreditaSubsanacion() throws Exception {
        long id=observar();var antes=actuaciones();
        mvc.perform(post(base()+"/observaciones/"+id+"/subsanar").header("Authorization","Bearer "+login("persona@example.invalid"))
            .contentType("application/json").content("{\"documentoSubsanacionNombre\":\"inexistente.pdf\",\"documentoSubsanacionRuta\":\"/api/documentos/999999/download\"}"))
            .andExpect(status().isBadRequest());
        assertThat(estado()).isEqualTo("PENDIENTE_INFORMACION");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void tipoDesconocidoNoSeConvierteEnEntregaTotal() throws Exception {
        var antes=actuaciones();responder("","INVENTADO").andExpect(status().isBadRequest());
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void aceptarNoConvierteSilenciosamenteUnaEntregaParcialEnTotal() throws Exception {
        var antes=actuaciones();responder("/aceptar","ENTREGA_PARCIAL").andExpect(status().isBadRequest());
        assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void schedulerRespetaPlazoAmpliadoPersistido() throws Exception {
        jdbc.update("update solicitudes set fecha_presentacion=?,fecha_limite=? where id_solicitud=?",
            LocalDateTime.now().minusDays(30),LocalDate.now().plusDays(5),solicitudId);
        var antes=actuaciones();scheduler.procesarAuditoriaDePlazos();
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(actuaciones()).isEqualTo(antes);
        // Once the stored limit really expires, persist one transition and one attempt.
        // MOCK is the notification provider; its persisted attempt is not legal efficacy.
        jdbc.update("update solicitudes set fecha_limite=? where id_solicitud=?",LocalDate.now().minusDays(1),solicitudId);
        scheduler.procesarAuditoriaDePlazos();assertThat(estado()).isEqualTo("VENCIDA");
        assertThat(jdbc.queryForObject("select count(*) from intentos_notificacion where id_solicitud=?",Long.class,solicitudId)).isEqualTo(1L);
        var vencida=actuaciones();scheduler.procesarAuditoriaDePlazos();assertThat(actuaciones()).isEqualTo(vencida);
    }
    @Test void schedulerNoVenceDuranteElUltimoDiaPermitido() throws Exception {
        jdbc.update("update solicitudes set fecha_presentacion=?,fecha_limite=? where id_solicitud=?",
            LocalDateTime.now().minusDays(30),LocalDate.now(),solicitudId);
        var antes=actuaciones();scheduler.procesarAuditoriaDePlazos();
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void respuestaValidaSeRecuperaYElReintentoNoDuplica() throws Exception {
        var r=json.readTree(responder("","ENTREGA_PARCIAL").andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        mvc.perform(get(base()).header("Authorization","Bearer "+login("persona@example.invalid")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.respuesta.id").value(r.path("id").asLong()))
            .andExpect(jsonPath("$.respuesta.tipoRespuesta").value("ENTREGA_PARCIAL"));
        var antes=actuaciones();responder("","ENTREGA_PARCIAL").andExpect(status().isConflict());
        assertThat(actuaciones()).isEqualTo(antes);
    }
    @Test void respuestaTardiaPermitidaNoModificaElLimiteLegal() throws Exception {
        LocalDate limite=LocalDate.now().minusDays(3);
        jdbc.update("update solicitudes set estado='VENCIDA',fecha_limite=? where id_solicitud=?",limite,solicitudId);
        responder("","ENTREGA_TOTAL").andExpect(status().isCreated());
        assertThat(estado()).isEqualTo("RESPONDIDA");
        assertThat(jdbc.queryForObject("select fecha_limite from solicitudes where id_solicitud=?",LocalDate.class,solicitudId)).isEqualTo(limite);
    }
    @ParameterizedTest @ValueSource(strings={"persona@example.invalid","otra@example.invalid","ajeno@example.invalid"})
    void actorAjenoNoModificaEstadoNiActuaciones(String email) throws Exception {
        var antes=actuaciones();String ajeno=login(email);
        mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+ajeno).contentType("application/json")
            .content("{\"estado\":\"RESPONDIDA\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+ajeno).contentType("application/json")
            .content(respuesta("ENTREGA_TOTAL"))).andExpect(status().isForbidden());
        assertThat(estado()).isEqualTo("RECEPCIONADA");assertThat(actuaciones()).isEqualTo(antes);
    }
    long liquidar() throws Exception {
        jdbc.update("update solicitudes set formato_fisico=true where id_solicitud=?", solicitudId);
        var body=Map.of("monto",12.30,"concepto","Copias solicitadas", "fechaNotificacion",LocalDate.now().toString(),
                "medioNotificacion","PLATAFORMA", "responsable","Operador sintético");
        return json.readTree(mvc.perform(post(base()+"/liquidaciones").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(body))).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("id").asLong();
    }
    @Test void recojoNoReabreSolicitudConcluida() throws Exception {
        long id=liquidar();jdbc.update("update solicitudes set estado='CONCLUIDA' where id_solicitud=?",solicitudId);
        var antes=actuaciones();
        mvc.perform(patch(base()+"/liquidaciones/"+id).header("Authorization","Bearer "+token)
                .contentType("application/json").content("{\"estado\":\"RECOGIDA\"}")).andExpect(status().isConflict());
        assertThat(estado()).isEqualTo("CONCLUIDA");assertThat(actuaciones()).isEqualTo(antes);
        assertThat(jdbc.queryForObject("select estado_liquidacion from liquidaciones_costo_solicitud where id_liquidacion=?",String.class,id)).isEqualTo("NOTIFICADA");
    }
    @Test void recojoNoInventaUnPago() throws Exception {
        long id=liquidar();
        mvc.perform(patch(base()+"/liquidaciones/"+id).header("Authorization","Bearer "+token)
                .contentType("application/json").content("{\"estado\":\"RECOGIDA\"}")).andExpect(status().isOk());
        assertThat(estado()).isEqualTo("RESPONDIDA");
        assertThat(jdbc.queryForObject("select fecha_pago from liquidaciones_costo_solicitud where id_liquidacion=?",LocalDate.class,id)).isNull();
    }
    @Test void archivoPorNoRecojoNoSobrescribeRespuestaRegistrada() throws Exception {
        long id=liquidar();responder("","ENTREGA_TOTAL").andExpect(status().isCreated());
        jdbc.update("update liquidaciones_costo_solicitud set fecha_limite_recojo=? where id_liquidacion=?",LocalDate.now().minusDays(1),id);
        var antes=actuaciones();assertThat(servicio.procesarLiquidacionesVencidas()).isEmpty();
        assertThat(estado()).isEqualTo("RESPONDIDA");assertThat(actuaciones()).isEqualTo(antes);
    }

    @Test void migracionesYContratoReal() throws Exception {
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();assertThat(flyway.info().pending()).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where success=false",Long.class)).isZero();
        String dir=System.getenv("SAIP_POSTGRES_ARTIFACTS");if(dir!=null){
            var res=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/v3/api-docs")).GET().build(),HttpResponse.BodyHandlers.ofString());
            assertThat(res.statusCode()).isEqualTo(200);Files.writeString(Path.of(dir,"openapi-saip.json"),res.body());
            Files.writeString(Path.of(dir,"flyway-saip.txt"),Arrays.toString(Arrays.stream(flyway.info().applied()).map(i->i.getVersion()+" "+i.getDescription()+" "+i.getChecksum()).toArray()));
        }
    }

    @Test void subsanacionTextualLegitimaConservaSuComandoYNoInventaDocumento() throws Exception {
        long id=observar(); String ciudadano=login("persona@example.invalid");
        String ruta=base()+"/observaciones/"+id+"/subsanar";
        mvc.perform(post(ruta).header("Authorization","Bearer "+ciudadano).contentType("application/json")
            .content("{\"comentarioSubsanacion\":\"Preciso que el periodo solicitado es 2025\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("SUBSANADA"))
            .andExpect(jsonPath("$.documentoSubsanacionRuta").isEmpty());
        var antes=actuaciones(); assertThat(estado()).isEqualTo("EN_REVISION");
        assertThat(jdbc.queryForObject("""
                select s.fecha_limite from solicitudes s
                join observaciones_solicitud o on o.id_solicitud=s.id_solicitud
                where o.id_observacion=?
                """, LocalDate.class, id))
                .isEqualTo(DiasHabilesUtil.sumarDiasHabiles(
                        jdbc.queryForObject("select cast(fecha_subsanacion as date) from observaciones_solicitud where id_observacion=?",
                                LocalDate.class, id), 10));
        mvc.perform(post(ruta).header("Authorization","Bearer "+ciudadano).contentType("application/json")
            .content("{\"comentarioSubsanacion\":\"Preciso que el periodo solicitado es 2025\"}"))
            .andExpect(status().isConflict());
        assertThat(actuaciones()).isEqualTo(antes);
    }

    @Test void subsanacionAjenaNoCambiaLaObservacion() throws Exception {
        long id=observar(); var antes=actuaciones();
        mvc.perform(post(base()+"/observaciones/"+id+"/subsanar").header("Authorization","Bearer "+login("otra@example.invalid"))
            .contentType("application/json").content("{\"comentarioSubsanacion\":\"Texto ajeno\"}"))
            .andExpect(status().isForbidden());
        assertThat(estado()).isEqualTo("PENDIENTE_INFORMACION");assertThat(actuaciones()).isEqualTo(antes);
    }

    @Test void vencimientoDeObservacionSaipMantieneCierreDocumentadoSinDuplicar() throws Exception {
        long id=observar(); jdbc.update("update observaciones_solicitud set fecha_limite_subsanacion=? where id_observacion=?",LocalDate.now().minusDays(1),id);
        assertThat(servicio.procesarObservacionesVencidas()).hasSize(1);
        assertThat(estado()).isEqualTo("CONCLUIDA");
        String traza=jdbc.queryForObject("select trazabilidad from observaciones_solicitud where id_observacion=?",String.class,id);
        assertThat(servicio.procesarObservacionesVencidas()).isEmpty();
        assertThat(jdbc.queryForObject("select trazabilidad from observaciones_solicitud where id_observacion=?",String.class,id)).isEqualTo(traza);
        var antes=actuaciones();responder("","ENTREGA_TOTAL").andExpect(status().isConflict());
        assertThat(actuaciones()).isEqualTo(antes);
    }

    @Test void estadoInvalidoOAusenteNoGenera500NiEfectos() throws Exception {
        var antes=actuaciones();
        for(String body:List.of("{}","{\"estado\":\"INVENTADO\"}"))
            mvc.perform(patch(base()+"/estado").header("Authorization","Bearer "+token).contentType("application/json").content(body))
                .andExpect(status().isUnprocessableEntity());
        assertThat(actuaciones()).isEqualTo(antes);assertThat(estado()).isEqualTo("RECEPCIONADA");
    }

    @Test void respuestaNoPuedeAtribuirseAOtroFuncionarioNiRecursoInexistente() throws Exception {
        var body=json.readTree(respuesta("ENTREGA_TOTAL")); var antes=actuaciones();
        var suplantada=json.createObjectNode();suplantada.setAll((tools.jackson.databind.node.ObjectNode)body);
        suplantada.put("funcionarioId",funcionarioId+1);
        mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsString(suplantada)))
            .andExpect(status().isForbidden());
        suplantada.put("funcionarioId",funcionarioId);suplantada.put("solicitudId",999999L);
        mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(json.writeValueAsString(suplantada)))
            .andExpect(status().isNotFound());
        assertThat(actuaciones()).isEqualTo(antes);
    }

    @Test void encauzamientoConcurrenteRevalidaEntidadDespuesDelBloqueo() throws Exception {
        try(var executor=Executors.newFixedThreadPool(2)) {
            CountDownLatch derivado=new CountDownLatch(1), liberar=new CountDownLatch(1);
            var derivacion=executor.submit(()->new TransactionTemplate(manager).execute(tx->{
                try {
                    mvc.perform(post(base()+"/encauzamientos").header("Authorization","Bearer "+token).contentType("application/json")
                        .content(json.writeValueAsString(Map.of("entidadDestinoId",otraEntidadId,"alcance","TOTAL","motivoEncauzamiento","Competencia de la entidad destinataria"))))
                        .andExpect(status().isCreated());
                    derivado.countDown(); if(!liberar.await(20,TimeUnit.SECONDS)) throw new IllegalStateException("Timeout sintético");
                } catch(Exception e){throw new IllegalStateException(e);}return null;
            }));
            assertThat(derivado.await(10,TimeUnit.SECONDS)).isTrue();String body=respuesta("ENTREGA_TOTAL");
            var intento=executor.submit(()->mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token)
                .contentType("application/json").content(body)).andReturn().getResponse().getStatus());
            try {
                long fin=System.nanoTime()+TimeUnit.SECONDS.toNanos(12); long esperando=0;
                while(System.nanoTime()<fin){esperando=jdbc.queryForObject("select count(*) from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%solicitudes%'",Long.class);if(esperando>0)break;Thread.sleep(20);}
                assertThat(esperando).isPositive();
            } finally {liberar.countDown();}
            derivacion.get(15,TimeUnit.SECONDS);assertThat(intento.get(20,TimeUnit.SECONDS)).isEqualTo(403);
            assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isZero();
            assertThat(jdbc.queryForObject("select count(*) from encauzamientos_solicitud",Long.class)).isEqualTo(1L);
            assertThat(jdbc.queryForObject("select id_entidad from solicitudes where id_solicitud=?",Long.class,solicitudId)).isEqualTo(otraEntidadId);
        }
    }

    @Test void dosRespuestasConcurrentesSoloRegistranUna() throws Exception {
        String body=respuesta("ENTREGA_TOTAL");
        var codigos=concurrentes(
            ()->mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andReturn().getResponse().getStatus(),
            ()->mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andReturn().getResponse().getStatus());
        assertThat(codigos).containsExactlyInAnyOrder(201,409);
        assertThat(jdbc.queryForObject("select count(*) from respuestas",Long.class)).isEqualTo(1L);
        assertThat(estado()).isEqualTo("RESPONDIDA");
    }

    @Test void observacionYRespuestaConcurrentesNoDejanActuacionesIncompatibles() throws Exception {
        String body=respuesta("ENTREGA_TOTAL");
        var codigos=concurrentes(
            ()->mvc.perform(post(base()+"/observaciones").header("Authorization","Bearer "+token).contentType("application/json")
                .content("{\"motivoObservacion\":\"Precisar periodo\"}")).andReturn().getResponse().getStatus(),
            ()->mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andReturn().getResponse().getStatus());
        assertThat(codigos.stream().filter(c->c==201).count()).isEqualTo(1);
        assertThat(codigos).allMatch(c->c==201 || c==409 || c==422);
        assertThat(jdbc.queryForObject("select (select count(*) from respuestas)+(select count(*) from observaciones_solicitud)",Long.class)).isEqualTo(1L);
        assertThat(estado()).isIn("RESPONDIDA","PENDIENTE_INFORMACION");
    }

    @Test void edicionOrdinariaConcurrenteNoRestauraEstadoAnterior() throws Exception {
        String body=respuesta("ENTREGA_TOTAL");
        assertThat(concurrentes(
            ()->mvc.perform(put(base()).header("Authorization","Bearer "+token).contentType("application/json")
                .content("{\"asunto\":\"Edición concurrente\"}")).andReturn().getResponse().getStatus(),
            ()->mvc.perform(post("/api/respuestas").header("Authorization","Bearer "+token).contentType("application/json").content(body)).andReturn().getResponse().getStatus()))
                .containsExactlyInAnyOrder(200,201);
        assertThat(estado()).isEqualTo("RESPONDIDA");
        assertThat(jdbc.queryForObject("select asunto from solicitudes where id_solicitud=?",String.class,solicitudId)).isEqualTo("Edición concurrente");
    }

    /** Two HTTP security chains wait on distinct PostgreSQL connections/transactions. */
    List<Integer> concurrentes(Callable<Integer> uno,Callable<Integer> dos) throws Exception {
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
}
