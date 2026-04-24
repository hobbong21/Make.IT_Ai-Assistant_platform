package com.humanad.makit.auth;

import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtTokenProviderTest {

    private final JwtTokenProvider provider = new JwtTokenProvider(
            new MockEnvironment(),
            "dGVzdC1zZWNyZXQtMzItYnl0ZS1taW5pbXVtLWZvci1obWFjLXNoYTI1Ng==",
            Duration.ofMinutes(15),
            Duration.ofDays(7),
            "https://makit.example.com",
            "makit-web"
    );

    @Test
    void prodProfileShortSecretFailsFast() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("prod");
        assertThatThrownBy(() -> new JwtTokenProvider(
                prodEnv,
                "too-short",
                Duration.ofMinutes(15),
                Duration.ofDays(7),
                "https://makit.example.com",
                "makit-web"
        )).isInstanceOf(IllegalStateException.class)
          .hasMessageContaining("JWT_SECRET must be >= 32 chars when profile=prod");
    }

    @Test
    void accessTokenRoundTrip() {
        UUID userId = UUID.randomUUID();
        String token = provider.generateAccessToken(userId, "u@x.com", UserRole.ADMIN, "acme");
        Claims claims = provider.parse(token);
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("email")).isEqualTo("u@x.com");
        assertThat(claims.get("role")).isEqualTo("ADMIN");
        assertThat(claims.get("companyId")).isEqualTo("acme");
    }

    @Test
    void refreshTokenHasTypeClaim() {
        String token = provider.generateRefreshToken(UUID.randomUUID());
        assertThat(provider.parse(token).get("type")).isEqualTo("refresh");
    }

    @Test
    void accessTtlSecondsIs15Min() {
        assertThat(provider.accessTtlSeconds()).isEqualTo(900);
    }
}
