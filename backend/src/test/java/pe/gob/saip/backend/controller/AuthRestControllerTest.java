package pe.gob.saip.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import pe.gob.saip.backend.model.entity.Ciudadano;
import pe.gob.saip.backend.model.entity.Usuario;
import pe.gob.saip.backend.repository.CiudadanoRepository;
import pe.gob.saip.backend.security.JwtService;
import pe.gob.saip.backend.service.*;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthRestController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthRestControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    UsuarioService usuarioService;

    @MockitoBean
    CiudadanoService ciudadanoService;

    @MockitoBean
    CiudadanoRepository ciudadanoRepository;

    @MockitoBean
    FuncionarioService funcionarioService;

    @MockitoBean
    MiembroTTAIPService miembroTTAIPService;

    @MockitoBean
    AdministradorService administradorService;

    @MockitoBean
    JwtService jwtService;

    @MockitoBean
    PasswordEncoder passwordEncoder;

    @MockitoBean
    AutorizacionRecursosService autorizacionRecursosService;

    @BeforeEach
    void setup() {
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$12$encodedHash");
    }

    private Ciudadano crearCiudadano(String hashedPassword) {
        Ciudadano c = new Ciudadano();
        c.setIdUsuario(1L);
        c.setEmail("ciudadano@test.com");
        c.setPassword(hashedPassword);
        c.setTipoUsuario(Usuario.TipoUsuario.CIUDADANO);
        c.setActivo(true);
        c.setFechaRegistro(LocalDateTime.now());
        c.setDni("12345678");
        c.setNombreCompleto("Juan Pérez");
        return c;
    }

    @Test
    void login_credencialesCorrectas_debeRetornarTokenJWT() throws Exception {
        var ciudadano = crearCiudadano("$2a$12$hashedpassword");
        when(usuarioService.obtenerUsuarioPorEmail("ciudadano@test.com")).thenReturn(Optional.of(ciudadano));
        when(ciudadanoService.findById(1L)).thenReturn(Optional.of(ciudadano));
        when(passwordEncoder.matches("pass123", "$2a$12$hashedpassword")).thenReturn(true);
        when(jwtService.generateToken(anyString(), anyString(), any())).thenReturn("test.jwt.token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"identificador":"ciudadano@test.com","password":"pass123"}
                            """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").value("test.jwt.token"))
                .andExpect(jsonPath("$.tipoUsuario").value("CIUDADANO"))
                .andExpect(jsonPath("$.redirectUrl").value("/ciudadano/dashboard"));
    }

    @Test
    void login_passwordIncorrecto_debeRetornar401() throws Exception {
        var ciudadano = crearCiudadano("$2a$12$hashedpassword");
        when(usuarioService.obtenerUsuarioPorEmail("ciudadano@test.com")).thenReturn(Optional.of(ciudadano));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"identificador":"ciudadano@test.com","password":"wrongpass"}
                            """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:unauthorized"))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Contraseña incorrecta"))
                .andExpect(jsonPath("$.instance").value("/api/auth/login"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mensaje").value("Contraseña incorrecta"));
    }

    @Test
    void login_emailNoExistente_debeRetornar401() throws Exception {
        when(usuarioService.obtenerUsuarioPorEmail("noexiste@test.com")).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"identificador":"noexiste@test.com","password":"pass123"}
                            """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:unauthorized"))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Usuario no encontrado"))
                .andExpect(jsonPath("$.instance").value("/api/auth/login"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mensaje").value("Usuario no encontrado"));
    }

    @Test
    void login_identificadorEnBlanco_debeRetornar400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"identificador":"","password":"pass123"}
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:validation-failed"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/auth/login"))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void login_sinCampos_debeRetornar400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:validation-failed"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/auth/login"))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void login_usuarioDesactivado_debeRetornar401() throws Exception {
        var ciudadano = crearCiudadano("$2a$12$hashedpassword");
        ciudadano.setActivo(false);
        when(usuarioService.obtenerUsuarioPorEmail("ciudadano@test.com")).thenReturn(Optional.of(ciudadano));
        when(passwordEncoder.matches("pass123", "$2a$12$hashedpassword")).thenReturn(true);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"identificador":"ciudadano@test.com","password":"pass123"}
                            """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:unauthorized"))
                .andExpect(jsonPath("$.title").value("Unauthorized"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.detail").value("Usuario desactivado"))
                .andExpect(jsonPath("$.instance").value("/api/auth/login"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mensaje").value("Usuario desactivado"));
    }

    @Test
    void registro_datosValidos_debeRetornar201() throws Exception {
        when(usuarioService.obtenerUsuarioPorEmail("nuevo@test.com")).thenReturn(Optional.empty());
        when(ciudadanoService.obtenerCiudadanoPorDni("87654321")).thenReturn(Optional.empty());
        var ciudadano = crearCiudadano("$2a$12$encoded");
        ciudadano.setEmail("nuevo@test.com");
        when(ciudadanoService.guardarCiudadano(any())).thenReturn(ciudadano);

        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"nuevo@test.com","password":"pass123","dni":"87654321","nombreCompleto":"María García"}
                            """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.mensaje").value("Registro exitoso"));
    }

    @Test
    void registro_emailDuplicado_debeRetornar409() throws Exception {
        when(usuarioService.obtenerUsuarioPorEmail("existe@test.com")).thenReturn(Optional.of(crearCiudadano("hash")));

        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"existe@test.com","password":"pass123","dni":"87654321","nombreCompleto":"María García"}
                            """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:conflict"))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Ya existe un usuario con ese email"))
                .andExpect(jsonPath("$.instance").value("/api/auth/registro"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mensaje").value("Ya existe un usuario con ese email"));
    }

    @Test
    void registro_dniDuplicado_debeRetornar409() throws Exception {
        when(usuarioService.obtenerUsuarioPorEmail("nuevo@test.com")).thenReturn(Optional.empty());
        when(ciudadanoService.obtenerCiudadanoPorDni("12345678")).thenReturn(Optional.of(crearCiudadano("hash")));

        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"nuevo@test.com","password":"pass123","dni":"12345678","nombreCompleto":"María García"}
                            """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:conflict"))
                .andExpect(jsonPath("$.title").value("Conflict"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Ya existe un ciudadano con ese DNI"))
                .andExpect(jsonPath("$.instance").value("/api/auth/registro"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.mensaje").value("Ya existe un ciudadano con ese DNI"));
    }

    @Test
    void registro_dniInvalido_debeRetornar400() throws Exception {
        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"nuevo@test.com","password":"pass123","dni":"123","nombreCompleto":"María García"}
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:validation-failed"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/auth/registro"))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void registro_passwordCorta_debeRetornar400() throws Exception {
        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"nuevo@test.com","password":"ab","dni":"87654321","nombreCompleto":"María García"}
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:validation-failed"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/auth/registro"))
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void registro_camposFaltantes_debeRetornar400() throws Exception {
        mockMvc.perform(post("/api/auth/registro")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                            {"email":"nuevo@test.com"}
                            """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:saip:problem:validation-failed"))
                .andExpect(jsonPath("$.title").value("Validation failed"))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.instance").value("/api/auth/registro"))
                .andExpect(jsonPath("$.success").value(false));
    }
}
