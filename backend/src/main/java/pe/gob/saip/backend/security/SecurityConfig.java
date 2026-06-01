package pe.gob.saip.backend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import pe.gob.saip.backend.exception.ApiProblemDetails;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final JsonMapper jsonMapper;

    @Value("${app.cors.allowed-origin-patterns:http://localhost:4200,http://localhost:4201,http://localhost:4300,http://localhost:5173,http://127.0.0.1:4200,http://127.0.0.1:4201,http://127.0.0.1:4300,http://127.0.0.1:5173,https://web.postman.co,https://*.postman.com,https://*.postman.co}")
    private List<String> allowedOriginPatterns;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, JsonMapper jsonMapper) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.jsonMapper = jsonMapper;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .anonymous(anonymous -> anonymous.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> writeProblem(response,
                                ApiProblemDetails.create(
                                        HttpStatus.UNAUTHORIZED,
                                        "Unauthorized",
                                        "Token faltante, inválido o expirado.",
                                        request.getRequestURI())))
                        .accessDeniedHandler((request, response, accessDeniedException) -> writeProblem(response,
                                ApiProblemDetails.create(
                                        HttpStatus.FORBIDDEN,
                                        "Forbidden",
                                        "El usuario autenticado no tiene permisos para ejecutar esta operación.",
                                        request.getRequestURI()))))
                .authorizeHttpRequests(auth -> auth

                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/public")).permitAll()
                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/solicitudes/publica/expediente")).permitAll()

                        .requestMatchers(resourceMatchers("/api/ciudadanos")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(resourceMatchers("/api/usuarios")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/notificaciones/enviar").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/solicitudes/*/notificaciones/intentos").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/solicitudes")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/observaciones").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/observaciones/*/subsanar").hasAnyRole("CIUDADANO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/observaciones/vencidas/procesar").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/ampliaciones").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, "/api/solicitudes/*/ampliaciones/*/cronograma/*").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/encauzamientos").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/*/liquidaciones").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, "/api/solicitudes/*/liquidaciones/*").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/solicitudes/liquidaciones/vencidas/procesar").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/solicitudes")).hasAnyRole("CIUDADANO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/solicitudes")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, resourceMatchers("/api/solicitudes")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/solicitudes")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/respuestas")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/respuestas")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/respuestas")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/respuestas")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/apelaciones")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/apelaciones/entidad/*/pendientes-elevacion").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/apelaciones/*/elevacion/elevar").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/apelaciones/elevaciones/vencidas/procesar").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/apelaciones/*/elevacion/admitir-excepcionalmente").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/apelaciones")).hasAnyRole("CIUDADANO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/apelaciones")).hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, resourceMatchers("/api/apelaciones")).hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/apelaciones")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/descargos/*/presentar").hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/descargos").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/descargos/activo").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/notificaciones").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/notificaciones/*/enviar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/notificaciones/*/intentos").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/notificaciones/*").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/notificaciones/*/constancia-envio").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/notificaciones/*/acuse-automatico").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/notificaciones/*/validacion-manual").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/suspensiones").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/descargos/requerir").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/suspensiones/informe-oral").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/suspensiones/informacion-complementaria").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, "/api/ttaip/expedientes/*/suspensiones/*/cancelar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/cumplimientos").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/ttaip/expedientes/*/cumplimientos/activo").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/expedientes/*/resoluciones/*/cumplimientos").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(request -> HttpMethod.POST.matches(request.getMethod())
                                && request.getRequestURI().matches(
                                "^/api/ttaip/expedientes/[^/]+/cumplimientos/[^/]+/registrar$"))
                        .hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, "/api/ttaip/expedientes/*/cumplimientos/*/observar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, "/api/ttaip/expedientes/*/cumplimientos/*/cerrar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/descargos/vencidos/procesar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, "/api/ttaip/cumplimientos/vencidos/procesar").hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.GET, "/api/notificaciones/motor/estado").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(resourceMatchers("/api/ttaip")).hasAnyRole("TTAIP", "ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/funcionarios")).hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/funcionarios")).hasRole("ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/funcionarios")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/funcionarios")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/entidades")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/entidades")).hasRole("ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/entidades")).hasRole("ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/entidades")).hasRole("ADMINISTRADOR")

                        .requestMatchers(resourceMatchers("/api/estadisticas")).hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(resourceMatchers("/api/reportes")).hasAnyRole("FUNCIONARIO", "TTAIP", "ADMINISTRADOR")

                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        List<String> normalizedOrigins = allowedOriginPatterns.stream()
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .distinct()
                .toList();

        configuration.setAllowedOriginPatterns(normalizedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
        configuration.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin",
                "X-Requested-With",
                "Cache-Control",
                "Pragma",
                "Postman-Token"
        ));
        configuration.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    private static String[] resourceMatchers(String basePath) {
        return new String[]{basePath, basePath + "/**"};
    }

    private void writeProblem(HttpServletResponse response, ProblemDetail problem) throws IOException {
        response.setStatus(problem.getStatus());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        jsonMapper.writeValue(response.getOutputStream(), problem);
    }
}


