package pe.gob.saip.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Entidad;
import pe.gob.saip.backend.model.entity.Funcionario;
import pe.gob.saip.backend.model.entity.Solicitud;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.service.UsuarioService;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.repository.EntidadRepository;
import pe.gob.saip.backend.repository.FuncionarioRepository;
import pe.gob.saip.backend.repository.SolicitudRepository;
import pe.gob.saip.backend.repository.UsuarioRepository;
import pe.gob.saip.backend.repository.DispositivoNotificacionPushRepository;
import tools.jackson.databind.json.JsonMapper;

/**
 * Real login/BCrypt/JWT, security filters and committed JPA data. MockMvc supplies
 * only the servlet transport; no authentication or persistence bean is mocked.
 * Suppress automatic request dumps so failed regressions do not print JWTs.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:jwt_account_status;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.flyway.enabled=false",
        "app.storage.provider=local",
        "app.notifications.mode=MOCK",
        "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class JwtAccountStatusIntegrationTest {
    private static final Path STORAGE = createStorage();
    private static final String TEST_PASSWORD = "R4-isolated-test-password";

    @Autowired protected MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired protected JwtService jwt;
    @Autowired private PasswordEncoder passwords;
    @Autowired private Environment environment;
    @Autowired protected PlatformTransactionManager transactionManager;
    @Autowired protected UsuarioRepository users;
    @Autowired protected UsuarioService userService;
    @Autowired private CiudadanoRepository citizens;
    @Autowired private FuncionarioRepository officials;
    @Autowired private EntidadRepository entities;
    @Autowired private SolicitudRepository requests;
    @Autowired private DispositivoNotificacionPushRepository devices;

    private TransactionTemplate transactions;
    protected Ciudadano owner;
    protected Ciudadano otherCitizen;
    private Ciudadano removableCitizen;
    private Funcionario official;
    protected Solicitud ownRequest;
    private Solicitud otherRequest;

    @DynamicPropertySource
    static void localStorage(DynamicPropertyRegistry registry) {
        registry.add("app.storage.local.base-path", STORAGE::toString);
    }

    @BeforeEach
    void createCommittedSyntheticAccountsAndResources() {
        assertNoResidualAuthentication();
        transactions = new TransactionTemplate(transactionManager);
        String encodedPassword = passwords.encode(TEST_PASSWORD);
        transactions.executeWithoutResult(status -> {
            owner = citizen("owner", encodedPassword);
            otherCitizen = citizen("other", encodedPassword);
            removableCitizen = citizen("removed", encodedPassword);
            Entidad ownEntity = entity("Entidad autorizada R4");
            Entidad otherEntity = entity("Otra entidad R4");
            official = new Funcionario();
            official.setEmail("official-" + UUID.randomUUID() + "@example.test");
            official.setNombreCompleto("Funcionario sintético R4");
            official.setPassword(encodedPassword);
            official.setTipoUsuario(Usuario.TipoUsuario.FUNCIONARIO);
            official.setEntidad(ownEntity);
            official = officials.saveAndFlush(official);
            ownRequest = request(owner, ownEntity);
            otherRequest = request(otherCitizen, otherEntity);
        });
    }

    @Test
    void logoutInvalidatesOnlyTheVerifiedIssuanceAndRepeatedLogoutReturns401() throws Exception {
        String first = login(owner);
        String second = login(owner);
        assertThat(jwt.extraerSesion(first).jti()).isNotEqualTo(jwt.extraerSesion(second).jti());
        access(ownRequest, first, 200);
        access(ownRequest, second, 200);
        mvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + first))
                .andExpect(status().isNoContent());
        access(ownRequest, first, 401);
        access(ownRequest, second, 200);
        mvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + first))
                .andExpect(status().isUnauthorized());
        assertThat(users.findById(owner.getId()).orElseThrow().getVersionAutenticacion()).isZero();
    }

    @Test
    void logoutCannotSelectAnotherUserOrIssuanceFromTheRequestBody() throws Exception {
        String ownToken = login(owner);
        String other = login(otherCitizen);
        mvc.perform(post("/api/auth/logout").header(HttpHeaders.AUTHORIZATION, "Bearer " + ownToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "usuarioId", otherCitizen.getId(), "jti", jwt.extraerSesion(other).jti()))))
                .andExpect(status().isNoContent());
        access(ownRequest, ownToken, 401);
        access(otherRequest, other, 200);
        access(ownRequest, other, 403);
    }

    @Test
    void logoutRejectsMissingInvalidAndPreJtiTokensWithoutAuthenticatingOrFailing() throws Exception {
        String missingJti = Jwts.builder().subject(IdentidadUsuario.subject(owner.getId()))
                .claim("authVersion", "0").expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(environment.getRequiredProperty("jwt.secret").getBytes(StandardCharsets.UTF_8)))
                .compact();
        for (String token : new String[]{missingJti, "not-a-token", ""}) {
            var call = post("/api/auth/logout");
            if (!token.isEmpty()) call.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
            assertGenericUnauthorized(mvc.perform(call).andExpect(status().isUnauthorized()).andReturn(), token);
            access(ownRequest, token, 401);
        }
        access(ownRequest, login(owner), 200);
    }

    @Test
    void realLoginIssuesCompatibleTokenAndActiveCitizenCanAccessOwnedResource() throws Exception {
        String token = login(owner);
        assertThat(Jwts.parser().verifyWith(Keys.hmacShaKeyFor(environment.getRequiredProperty("jwt.secret")
                .getBytes(StandardCharsets.UTF_8))).build().parseSignedClaims(token).getPayload().getSubject())
                .isEqualTo("saip:user:v1:" + owner.getId());
        access(ownRequest, token, 200);
        access(ownRequest, null, 401);
        access(ownRequest, token, 200);
    }

    @Test
    void deactivationAfterRealLoginRejectsTheSameStillValidJwt() throws Exception {
        String token = login(owner);
        access(ownRequest, token, 200);
        setActive(owner, false);
        assertThat(jwt.isTokenValid(token)).isTrue();
        assertThat(users.findById(owner.getId()).orElseThrow().getActivo()).isFalse();
        access(ownRequest, token, 401);
        protectedConfiguration(token, 401);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("identificador", owner.getEmail(), "password", TEST_PASSWORD))))
                .andExpect(status().isUnauthorized());
        assertNoResidualAuthentication();
    }

    @Test
    void reactivationMustNotRestoreTokensIssuedBeforeDeactivation() throws Exception {
        String token = login(owner);
        String secondToken = login(owner);
        String otherToken = login(otherCitizen);
        access(ownRequest, token, 200);
        setActive(owner, false);
        access(ownRequest, token, 401);
        access(ownRequest, secondToken, 401);
        setActive(owner, true);
        assertThat(jwt.isTokenValid(token)).isTrue();
        access(ownRequest, token, 401);
        access(ownRequest, secondToken, 401);
        access(otherRequest, otherToken, 200);
        String renewed = login(owner);
        access(ownRequest, renewed, 200);
        access(otherRequest, renewed, 403);
    }

    @Test
    void activeCitizensKeepResourceAndRoleAuthorizationAndNoAuthenticationLeaksBetweenRequests() throws Exception {
        String ownerToken = login(owner);
        String otherToken = login(otherCitizen);
        access(ownRequest, ownerToken, 200);
        access(ownRequest, otherToken, 403);
        access(otherRequest, otherToken, 200);
        access(otherRequest, ownerToken, 403);
        mvc.perform(get("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
        assertNoResidualAuthentication();
        access(ownRequest, null, 401);
        access(ownRequest, ownerToken, 200);
        protectedConfiguration(null, 401);
    }

    @Test
    void officialKeepsEntityAuthorizationAndIsAlsoRejectedAfterDeactivation() throws Exception {
        String token = login(official);
        access(ownRequest, token, 200);
        access(otherRequest, token, 403);
        setActive(official, false);
        access(ownRequest, token, 401);
        setActive(official, true);
        access(ownRequest, token, 401);
        String renewed = login(official);
        access(ownRequest, renewed, 200);
        access(otherRequest, renewed, 403);
    }

    @Test
    void expiredTamperedAndMalformedTokensReturnGeneric401WithoutResidualAuthentication() throws Exception {
        String valid = login(owner);
        String secret = environment.getRequiredProperty("jwt.secret");
        String expired = Jwts.builder().subject(IdentidadUsuario.subject(owner.getId())).id(UUID.randomUUID().toString())
                .claim("role", "CIUDADANO").claim("usuarioId", owner.getId())
                .claim("authVersion", "0")
                .issuedAt(Date.from(Instant.now().minusSeconds(120)))
                .expiration(Date.from(Instant.now().minusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8))).compact();
        int signatureStart = valid.lastIndexOf('.') + 1;
        String tampered = valid.substring(0, signatureStart)
                + (valid.charAt(signatureStart) == 'A' ? 'B' : 'A') + valid.substring(signatureStart + 1);
        for (String rejected : new String[]{expired, tampered, "not-a-jwt", ""}) {
            assertThat(jwt.isTokenValid(rejected)).isFalse();
            access(ownRequest, rejected, 401);
            access(ownRequest, null, 401);
            access(ownRequest, valid, 200);
        }
    }

    @Test
    void tokenForDeletedAccountReturns401InsteadOfEscapingTheFilterAsAnException() throws Exception {
        String token = login(removableCitizen);
        protectedConfiguration(token, 200);
        transactions.executeWithoutResult(status -> {
            citizens.deleteById(removableCitizen.getId());
            citizens.flush();
        });
        assertThat(users.findByEmail(removableCitizen.getEmail())).isEmpty();
        assertThat(jwt.isTokenValid(token)).isTrue();
        protectedConfiguration(token, 401);
        access(ownRequest, token, 401);
        access(ownRequest, null, 401);
        access(ownRequest, login(owner), 200);
    }

    @Test
    void emailChangeAndReuseKeepBothExistingTokensBoundToTheirOriginalUsers() throws Exception {
        String ownerToken = login(owner);
        String otherToken = login(otherCitizen);
        String originalEmail = owner.getEmail();
        changeEmail(owner, "changed-" + UUID.randomUUID() + "@example.test");
        access(ownRequest, ownerToken, 200);
        changeEmail(otherCitizen, originalEmail);
        access(ownRequest, ownerToken, 200);
        access(otherRequest, ownerToken, 403);
        access(otherRequest, otherToken, 200);
        access(ownRequest, otherToken, 403);
        mvc.perform(get("/api/auth/me/{id}", owner.getId()).header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(users.findById(owner.getId()).orElseThrow().getEmail()));
        mvc.perform(get("/api/auth/me/{id}", otherCitizen.getId()).header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken))
                .andExpect(status().isForbidden());
        Usuario reusedEmailUser = users.findById(otherCitizen.getId()).orElseThrow();
        access(otherRequest, login(reusedEmailUser), 200);
        assertNoResidualAuthentication();
    }

    @Test
    void deletingOriginalUserAndReusingTheirEmailDoesNotTransferTheirToken() throws Exception {
        String originalToken = login(removableCitizen);
        String originalEmail = removableCitizen.getEmail();
        transactions.executeWithoutResult(status -> {
            citizens.deleteById(removableCitizen.getId());
            citizens.flush();
        });
        changeEmail(otherCitizen, originalEmail);
        protectedConfiguration(originalToken, 401);
        access(otherRequest, originalToken, 401);
        access(otherRequest, login(users.findById(otherCitizen.getId()).orElseThrow()), 200);
    }

    @Test
    void legacyEmailSubjectsAreRejectedEvenWithAnOriginalSignedUserIdAndAfterEmailReuse() throws Exception {
        String originalEmail = owner.getEmail();
        String legacy = signedToken(originalEmail, owner.getId());
        protectedConfiguration(legacy, 401);
        changeEmail(owner, "renamed-" + UUID.randomUUID() + "@example.test");
        changeEmail(otherCitizen, originalEmail);
        protectedConfiguration(legacy, 401);
        access(otherRequest, legacy, 401);
        protectedConfiguration(signedToken(originalEmail, null), 401);
        protectedConfiguration(signedToken(originalEmail, otherCitizen.getId()), 401);
    }

    @Test
    void stableSubjectsMustBeCanonicalAndOtherClaimsCannotOverrideTheActor() throws Exception {
        for (String subject : new String[]{"saip:user:v1:0", "saip:user:v1:01", "saip:user:v1:-1",
                "saip:user:v1:9223372036854775808", "saip:user:v1:1 ", "saip:user:v2:1"}) {
            protectedConfiguration(signedToken(subject, owner.getId()), 401);
        }
        String conflictingClaim = signedToken(IdentidadUsuario.subject(owner.getId()), otherCitizen.getId());
        access(ownRequest, conflictingClaim, 200);
        access(otherRequest, conflictingClaim, 403);
    }

    @Test
    void pushRegistrationAndOwnershipUseOriginalActorAfterEmailChangeAndReuse() throws Exception {
        String originalEmail = owner.getEmail();
        String ownerToken = login(owner);
        changeEmail(owner, "push-owner-" + UUID.randomUUID() + "@example.test");
        changeEmail(otherCitizen, originalEmail);
        String otherToken = login(users.findById(otherCitizen.getId()).orElseThrow());
        MvcResult result = mvc.perform(post("/api/notificaciones/push/tokens")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("token", "synthetic-fcm-token-" + UUID.randomUUID(),
                                "appFlavor", "CIUDADANO", "plataforma", "ANDROID", "deviceIdHash", "a".repeat(64)))))
                .andExpect(status().isCreated()).andReturn();
        long deviceId = json.readTree(result.getResponse().getContentAsString()).path("id").asLong();
        Long recordedActor = transactions.execute(status -> devices.findById(deviceId).orElseThrow().getUsuario().getIdUsuario());
        assertThat(recordedActor).isEqualTo(owner.getId());
        mvc.perform(get("/api/notificaciones/push/tokens/mios").header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(deviceId));
        mvc.perform(get("/api/notificaciones/push/tokens/mios").header(HttpHeaders.AUTHORIZATION, "Bearer " + otherToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(delete("/api/notificaciones/push/tokens/{id}", deviceId).header(HttpHeaders.AUTHORIZATION, "Bearer " + otherToken))
                .andExpect(status().isForbidden());
        assertNoResidualAuthentication();
    }

    @Test
    void stableTokensWithoutAVersionAndInvalidOrMismatchedVersionsRequireNewLogin() throws Exception {
        for (Object version : new Object[]{null, 0L, "-1", "00", "1 ", "9223372036854775808", "1"}) {
            var builder = Jwts.builder().subject(IdentidadUsuario.subject(owner.getId()))
                    .id(UUID.randomUUID().toString())
                    .claim("usuarioId", owner.getId()).claim("role", "CIUDADANO")
                    .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(3600)));
            if (version != null) {
                builder.claim("authVersion", version);
            }
            String token = builder.signWith(Keys.hmacShaKeyFor(environment.getRequiredProperty("jwt.secret")
                    .getBytes(StandardCharsets.UTF_8))).compact();
            access(ownRequest, token, 401);
        }
        access(ownRequest, login(owner), 200);
    }

    @Test
    void everyAdministrativeDeactivationPathInvalidatesTokensAndRepeatedDisableIsIdempotent() throws Exception {
        String adminToken = login(createAdministrator());
        String[] paths = {"/api/usuarios/" + owner.getId(), "/api/usuarios/" + owner.getId() + "/estado",
                "/api/ciudadanos/" + owner.getId() + "/estado", "/api/funcionarios/" + official.getId() + "/estado"};
        for (int index = 0; index < paths.length; index++) {
            Usuario target = index == 3 ? official : owner;
            String oldToken = login(users.findById(target.getIdUsuario()).orElseThrow());
            long before = users.findById(target.getIdUsuario()).orElseThrow().getVersionAutenticacion();
            changeStateThroughApi(paths[index], index == 0, false, adminToken);
            access(ownRequest, oldToken, 401);
            assertThat(users.findById(target.getIdUsuario()).orElseThrow().getVersionAutenticacion()).isEqualTo(before + 1);
            changeStateThroughApi(paths[index], index == 0, false, adminToken);
            assertThat(users.findById(target.getIdUsuario()).orElseThrow().getVersionAutenticacion()).isEqualTo(before + 1);
            changeStateThroughApi(paths[index], index == 0, true, adminToken);
            access(ownRequest, oldToken, 401);
            access(ownRequest, login(users.findById(target.getIdUsuario()).orElseThrow()), 200);
        }
    }

    @Test
    void profileAndOldAdminPayloadCannotOverwriteGenerationOrRestoreTokens() throws Exception {
        String token = login(owner);
        String adminToken = login(createAdministrator());
        setActive(owner, false);
        mvc.perform(put("/api/ciudadanos/{id}", owner.getId()).header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "nombreCompleto", "Perfil actualizado", "email", owner.getEmail(), "activo", true,
                                "versionAutenticacion", 0, "authVersion", "0"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activo").value(false))
                .andExpect(jsonPath("$.versionAutenticacion").doesNotExist());
        changeStateThroughApi("/api/usuarios/" + owner.getId(), true, true, adminToken);
        assertThat(users.findById(owner.getId()).orElseThrow().getVersionAutenticacion()).isEqualTo(1L);
        access(ownRequest, token, 401);
        access(ownRequest, login(owner), 200);
    }

    private Usuario createAdministrator() {
        Usuario admin = new Usuario();
        admin.setEmail("admin-" + UUID.randomUUID() + "@example.test");
        admin.setPassword(passwords.encode(TEST_PASSWORD));
        admin.setTipoUsuario(Usuario.TipoUsuario.ADMINISTRADOR);
        admin.setActivo(true);
        return users.saveAndFlush(admin);
    }

    private void changeStateThroughApi(String path, boolean isPut, boolean active, String token) throws Exception {
        mvc.perform((isPut ? put(path) : patch(path)).header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(isPut ? Map.of(
                                "activo", active, "versionAutenticacion", 0, "authVersion", "0") : Map.of("activo", active))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activo").value(active))
                .andExpect(jsonPath("$.versionAutenticacion").doesNotExist());
    }

    private void changeEmail(Usuario user, String email) {
        transactions.executeWithoutResult(status -> {
            Usuario persisted = users.findById(user.getIdUsuario()).orElseThrow();
            persisted.setEmail(email);
            users.saveAndFlush(persisted);
        });
    }

    private String signedToken(String subject, Long userId) {
        return Jwts.builder().subject(subject).id(UUID.randomUUID().toString()).claim("usuarioId", userId).claim("role", "CIUDADANO")
                .claim("authVersion", "0")
                .issuedAt(new Date()).expiration(Date.from(Instant.now().plusSeconds(3600)))
                .signWith(Keys.hmacShaKeyFor(environment.getRequiredProperty("jwt.secret").getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    protected String login(Usuario user) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("identificador", user.getEmail(), "password", TEST_PASSWORD))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").isString()).andReturn();
        String token = json.readTree(result.getResponse().getContentAsString()).path("token").asText();
        assertThat(jwt.isTokenValid(token)).isTrue();
        assertNoResidualAuthentication();
        return token;
    }

    protected void access(Solicitud request, String token, int expectedStatus) throws Exception {
        var http = get("/api/solicitudes/{id}", request.getId());
        if (token != null) {
            http.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        MvcResult result = mvc.perform(http).andExpect(status().is(expectedStatus)).andReturn();
        if (expectedStatus == 200) {
            assertThat(json.readTree(result.getResponse().getContentAsString()).path("id").asLong()).isEqualTo(request.getId());
        } else if (expectedStatus == 401) {
            assertGenericUnauthorized(result, token);
        }
        assertNoResidualAuthentication();
    }

    private void protectedConfiguration(String token, int expectedStatus) throws Exception {
        var http = get("/api/configuracion");
        if (token != null) {
            http.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        MvcResult result = mvc.perform(http).andExpect(status().is(expectedStatus)).andReturn();
        if (expectedStatus == 401) {
            assertGenericUnauthorized(result, token);
        }
        assertNoResidualAuthentication();
    }

    private void assertGenericUnauthorized(MvcResult result, String token) throws Exception {
        String body = result.getResponse().getContentAsString();
        assertThat(result.getResponse().getContentType()).startsWith(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        assertThat(json.readTree(body).path("status").asInt()).isEqualTo(401);
        assertThat(json.readTree(body).path("detail").asText()).isEqualTo("Token faltante, inválido o expirado.");
        assertThat(body).doesNotContain(owner.getEmail(), otherCitizen.getEmail(), removableCitizen.getEmail(),
                "UsernameNotFoundException", "DisabledException", "stackTrace");
        if (token != null && !token.isEmpty()) {
            assertThat(body).doesNotContain(token);
        }
    }

    protected void setActive(Usuario user, boolean active) {
        userService.cambiarEstado(user.getIdUsuario(), active);
    }

    private void assertNoResidualAuthentication() {
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    private Ciudadano citizen(String label, String encodedPassword) {
        Ciudadano citizen = new Ciudadano();
        citizen.setEmail(label + "-" + UUID.randomUUID() + "@example.test");
        citizen.setNombreCompleto("Ciudadano sintético R4 " + label);
        citizen.setPassword(encodedPassword);
        citizen.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        return citizens.saveAndFlush(citizen);
    }

    private Entidad entity(String name) {
        Entidad entity = new Entidad();
        entity.setNombre(name);
        entity.setAcronimo("R4-" + UUID.randomUUID().toString().substring(0, 8));
        return entities.saveAndFlush(entity);
    }

    private Solicitud request(Ciudadano citizen, Entidad entity) {
        Solicitud request = new Solicitud();
        request.setExpediente("SAIP-2026-" + UUID.randomUUID().toString().substring(0, 8));
        request.setAsunto("Recurso sintético R4");
        request.setDescripcion("Comprobación de titularidad y entidad con JWT real");
        request.setCiudadano(citizen);
        request.setEntidad(entity);
        request.setEstado(Solicitud.EstadoSolicitud.EN_REVISION);
        request.setConsentimientoDatosPersonales(true);
        return requests.saveAndFlush(request);
    }

    private static Path createStorage() {
        try {
            return Files.createTempDirectory("yaiku-r4-accounts-");
        } catch (IOException exception) {
            throw new IllegalStateException("Cannot create isolated LOCAL storage", exception);
        }
    }

    @AfterAll
    static void removeStorage() throws IOException {
        try (var paths = Files.walk(STORAGE)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                Files.delete(path);
            }
        }
    }
}
