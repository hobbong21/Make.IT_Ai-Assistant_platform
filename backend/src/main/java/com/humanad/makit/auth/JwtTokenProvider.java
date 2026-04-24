package com.humanad.makit.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    private final SecretKey key;
    private final Duration accessTtl;
    private final Duration refreshTtl;
    private final String issuer;
    private final String audience;

    public JwtTokenProvider(
            Environment environment,
            @Value("${jwt.secret}") String secret,
            @Value("${jwt.access-token-ttl:PT15M}") Duration accessTtl,
            @Value("${jwt.refresh-token-ttl:P7D}") Duration refreshTtl,
            @Value("${jwt.issuer:https://makit.example.com}") String issuer,
            @Value("${jwt.audience:makit-web}") String audience
    ) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET must be set");
        }

        // Prod fail-fast: reject short/weak secrets when running under any prod* profile.
        boolean isProd = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(p -> p != null && p.startsWith("prod"));
        if (isProd && secret.length() < 32) {
            String msg = "JWT_SECRET must be >= 32 chars when profile=prod";
            log.error(msg + " (actual length={})", secret.length());
            throw new IllegalStateException(msg);
        }

        byte[] bytes;
        try {
            bytes = Decoders.BASE64.decode(secret);
        } catch (Exception ex) {
            bytes = secret.getBytes(StandardCharsets.UTF_8);
        }
        if (bytes.length < 32) {
            // Pad to 32 bytes for HS256 if shorter; recommend base64-encoded 32+ byte key in prod.
            byte[] padded = new byte[32];
            System.arraycopy(bytes, 0, padded, 0, Math.min(bytes.length, 32));
            bytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateAccessToken(UUID userId, String email, UserRole role, String companyId) {
        Date now = new Date();
        return Jwts.builder()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + accessTtl.toMillis()))
                .claims(Map.of(
                        "email", email,
                        "role", role.name(),
                        "companyId", companyId == null ? "" : companyId,
                        "type", "access"
                ))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        Date now = new Date();
        return Jwts.builder()
                .issuer(issuer)
                .audience().add(audience).and()
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiration(new Date(now.getTime() + refreshTtl.toMillis()))
                .claims(Map.of("type", "refresh"))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    public long refreshTtlSeconds() {
        return refreshTtl.toSeconds();
    }
}
