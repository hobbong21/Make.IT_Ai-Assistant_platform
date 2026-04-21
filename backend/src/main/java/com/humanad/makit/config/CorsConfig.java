package com.humanad.makit.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * CORS configuration.
 *
 * Reads the allowed-origin list from the {@code CORS_ALLOWED_ORIGINS} environment
 * variable (comma-separated). Falls back to a dev-friendly local list.
 *
 * Notes (QA-007/QA-008):
 * - {@code allowCredentials=true} requires EXPLICIT origins (no {@code "*"}) per spec.
 * - {@code allowedHeaders} is an explicit list — combining {@code "*"} with credentials
 *   is rejected or silently downgraded by modern browsers and Spring 6.
 */
@Configuration
public class CorsConfig {

    private static final String DEFAULT_ORIGINS =
            "http://localhost,http://localhost:80,http://localhost:3000,http://localhost:5173";

    @Value("${makit.cors.allowed-origins:${CORS_ALLOWED_ORIGINS:" + DEFAULT_ORIGINS + "}}")
    private String allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowCredentials(true);
        cfg.setAllowedOrigins(
                Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList()
        );
        // Explicit header allowlist — required when allowCredentials=true.
        cfg.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "X-Request-Id"
        ));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setExposedHeaders(List.of("X-Request-Id", "Location"));
        cfg.setMaxAge(3600L);
        source.registerCorsConfiguration("/**", cfg);
        return new CorsFilter(source);
    }
}
