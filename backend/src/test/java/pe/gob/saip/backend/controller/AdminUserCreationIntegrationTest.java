package pe.gob.saip.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import pe.gob.saip.backend.model.entity.Administrador;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.UsuarioRepository;
import tools.jackson.databind.json.JsonMapper;

/** Existing administrative contract exercised with real JWT/BCrypt/JPA on isolated H2.
 * Servlet transport is MockMvc; notifications are MOCK and push is disabled.
 * Request dumps are disabled to keep passwords and tokens out of failure reports.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:admin_explicit_password;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.flyway.enabled=false", "app.notifications.mode=MOCK",
        "app.notifications.push.enabled=false"
})
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminUserCreationIntegrationTest {
    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;
    @Autowired private UsuarioRepository users;
    @Autowired private PasswordEncoder passwords;
    private String adminToken;

    @BeforeEach
    void loginRealAdministrator() throws Exception {
        String password = UUID.randomUUID().toString();
        Administrador admin = new Administrador();
        admin.setEmail(email());
        admin.setNombreCompleto("Synthetic administrator");
        admin.setRol("ADMINISTRADOR");
        admin.setTipoUsuario(Usuario.TipoUsuario.ADMINISTRADOR);
        admin.setActivo(true);
        admin.setPassword(passwords.encode(password));
        users.saveAndFlush(admin);
        adminToken = login(admin.getEmail(), password);
    }

    @Test
    void explicitPasswordIsEncodedAndUsableWithoutReturningItInTheDto() throws Exception {
        String email = email();
        String password = " " + UUID.randomUUID() + " ";
        String response = mvc.perform(post("/api/usuarios")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(email, password))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        var dto = json.readTree(response);
        assertThat(dto.path("id").asLong()).isPositive();
        assertThat(dto.path("email").asText()).isEqualTo(email);
        assertThat(dto.has("password")).isFalse();
        assertThat(response.contains(password)).isFalse();
        var persisted = users.findByEmail(email).orElseThrow();
        assertThat(passwords.matches(password, persisted.getPassword())).isTrue();
        assertThat(persisted.getPassword().equals(password)).isFalse();
        assertThat(login(email, password).isBlank()).isFalse();
    }

    @Test
    void omittedBlankShortAndOverlongPasswordsDoNotCreateAccounts() throws Exception {
        for (String password : new String[] { null, "", "        ", "short", "a".repeat(73) }) {
            String email = email();
            Map<String, Object> body = body(email, password);
            mvc.perform(post("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                    .andExpect(status().isBadRequest());
            assertThat(users.findByEmail(email)).isEmpty();
        }
    }

    @Test
    void bcryptUtf8ByteLimitIsEnforcedWithoutCreatingAnAccount() throws Exception {
        String rejectedEmail = email();
        mvc.perform(post("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body(rejectedEmail, "ñ".repeat(36) + "a"))))
                .andExpect(status().isBadRequest());
        assertThat(users.findByEmail(rejectedEmail)).isEmpty();
        mvc.perform(post("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body(email(), "ñ".repeat(36)))))
                .andExpect(status().isCreated());
    }

    @Test
    void unauthenticatedOrNonAdministrativeActorsCannotCreateAccounts() throws Exception {
        String email = email();
        String password = UUID.randomUUID().toString();
        mvc.perform(post("/api/usuarios").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body(email, password))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body(email, password))))
                .andExpect(status().isCreated());
        String citizenToken = login(email, password);
        String anotherEmail = email();
        mvc.perform(post("/api/usuarios").header(HttpHeaders.AUTHORIZATION, "Bearer " + citizenToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body(anotherEmail, password))))
                .andExpect(status().isForbidden());
        assertThat(users.findByEmail(anotherEmail)).isEmpty();
    }

    private String login(String email, String password) throws Exception {
        String response = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("identificador", email, "password", password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response).path("token").asText();
    }

    private static Map<String, Object> body(String email, String password) {
        Map<String, Object> result = new HashMap<>();
        result.put("email", email);
        result.put("tipoUsuario", "CIUDADANO");
        result.put("nombre", "Synthetic account");
        if (password != null) result.put("password", password);
        return result;
    }

    private static String email() {
        return "admin-create-" + UUID.randomUUID() + "@example.invalid";
    }
}
