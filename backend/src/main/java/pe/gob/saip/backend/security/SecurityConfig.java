package pe.gob.saip.backend.security;

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

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

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
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth

                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()

                .requestMatchers("/api/ciudadanos/**").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/solicitudes/**").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/solicitudes/**").hasAnyRole("CIUDADANO", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/solicitudes/**").hasAnyRole("FUNCIONARIO", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/solicitudes/**").hasAnyRole("FUNCIONARIO", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/solicitudes/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/respuestas/**").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/respuestas/**").hasAnyRole("FUNCIONARIO", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/respuestas/**").hasAnyRole("FUNCIONARIO", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/respuestas/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/apelaciones/**").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/apelaciones/**").hasAnyRole("CIUDADANO", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/apelaciones/**").hasAnyRole("TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/apelaciones/**").hasAnyRole("TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/apelaciones/**").hasRole("ADMIN")

                .requestMatchers("/api/ttaip/**").hasAnyRole("TTAIP", "ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/funcionarios/**").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/funcionarios/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/funcionarios/**").hasAnyRole("FUNCIONARIO", "ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/funcionarios/**").hasRole("ADMIN")

                .requestMatchers(HttpMethod.GET, "/api/entidades/**").hasAnyRole("CIUDADANO", "FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/entidades/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/entidades/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/entidades/**").hasRole("ADMIN")

                .requestMatchers("/api/estadisticas/**").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMIN")
                .requestMatchers("/api/reportes/**").hasAnyRole("FUNCIONARIO", "TTAIP", "ADMIN")

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:4200", "http://localhost:4201"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }
}

