package com.humanad.makit.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI makitOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("MaKIT AI Marketing Platform API")
                        .version("1.0.0")
                        .description("Unified REST API for AX Data Intelligence, AX Marketing Intelligence, AX Commerce Brain."))
                .servers(List.of(
                        new Server().url("http://localhost:8083").description("Local dev"),
                        new Server().url("https://api.makit.example.com").description("Production")
                ))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
                .components(new Components().addSecuritySchemes(BEARER_SCHEME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                ));
    }
}
