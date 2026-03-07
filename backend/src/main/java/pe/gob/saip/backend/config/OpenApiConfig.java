package pe.gob.saip.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI saipOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
            .info(new Info()
                .title("Plataforma SAIP — API REST")
                .version("1.0.0")
                .description("""
                    API RESTful del Sistema de Acceso a la Información Pública (SAIP) \
                    y Apelaciones ante el Tribunal de Transparencia (TTAIP).
                    
                    ## Módulos
                    - **Autenticación**: Registro y login con JWT
                    - **Solicitudes SAIP**: Gestión de solicitudes de acceso a la información (Ley N° 27806)
                    - **Respuestas**: Respuestas de funcionarios a solicitudes SAIP
                    - **Apelaciones TTAIP**: Gestión de apelaciones ante el Tribunal de Transparencia
                    - **TTAIP**: Calificación y resolución de apelaciones por el tribunal
                    - **Ciudadanos**: Gestión de ciudadanos solicitantes
                    - **Funcionarios**: Gestión de funcionarios de entidades públicas
                    - **Entidades**: Gestión de entidades públicas
                    - **Estadísticas**: Indicadores y métricas del sistema
                    - **Reportes**: Reportes consolidados
                    """)
                .contact(new Contact()
                    .name("Equipo SAIP")
                    .email("soporte@plataforma-saip.test"))
                .license(new License()
                    .name("MIT")
                    .url("https://opensource.org/licenses/MIT")))
            .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
            .components(new Components()
                .addSecuritySchemes(securitySchemeName,
                    new SecurityScheme()
                        .name(securitySchemeName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Token JWT obtenido del endpoint POST /api/auth/login")));
    }
}
