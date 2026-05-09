package pe.gob.saip.backend.security;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.cors.allowed-origin-patterns:http://localhost:4200,http://localhost:4201,http://localhost:4300,http://localhost:5173,http://127.0.0.1:4200,http://127.0.0.1:4201,http://127.0.0.1:4300,http://127.0.0.1:5173,https://web.postman.co,https://*.postman.com,https://*.postman.co}")
    private List<String> allowedOriginPatterns;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
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
                .exceptionHandling(ex -> ex.authenticationEntryPoint(
                        (request, response, authException) -> response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "No autorizado")))
                .authorizeHttpRequests(auth -> auth

                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/h2-console/**").permitAll()
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()

                        .requestMatchers(resourceMatchers("/api/ciudadanos")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/solicitudes")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/solicitudes")).hasAnyRole("CIUDADANO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/solicitudes")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, resourceMatchers("/api/solicitudes")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/solicitudes")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/respuestas")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/respuestas")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/respuestas")).hasAnyRole("FUNCIONARIO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/respuestas")).hasRole("ADMINISTRADOR")

                        .requestMatchers(HttpMethod.GET, resourceMatchers("/api/apelaciones")).hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.POST, resourceMatchers("/api/apelaciones")).hasAnyRole("CIUDADANO", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PUT, resourceMatchers("/api/apelaciones")).hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.PATCH, resourceMatchers("/api/apelaciones")).hasAnyRole("TTAIP", "ADMINISTRADOR")
                        .requestMatchers(HttpMethod.DELETE, resourceMatchers("/api/apelaciones")).hasRole("ADMINISTRADOR")

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
}


