package com.humanad.makit.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.humanad.makit.common.ApiErrorResponse;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * IP-based rate limiter for auth endpoints (defense-in-depth on top of
 * nginx/gateway limits).
 *
 * <p>Applies a token bucket of {@code security.rate-limit.auth.capacity} requests
 * per {@code security.rate-limit.auth.refill-period} (default: 10 / 1 min) per
 * remote IP. Keyed off {@code X-Forwarded-For} first entry when present,
 * falling back to {@code remoteAddr}.</p>
 *
 * <p><strong>v1 limitation:</strong> storage is a single-JVM
 * {@link ConcurrentHashMap}. For multi-instance deployments this must be
 * migrated to a distributed store (Redis-backed Bucket4j, already on the
 * classpath via {@code spring-boot-starter-data-redis}). Tracked as v1.1
 * backlog in {@code _workspace/99_release_report.md}.</p>
 *
 * <p>Ordered at {@link Ordered#HIGHEST_PRECEDENCE} + 10 so it runs after
 * {@code RequestIdFilter} (so rejection responses still carry a request-id)
 * but before {@link JwtAuthenticationFilter}.</p>
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> LIMITED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/register",
            "/api/auth/refresh"
    );

    private final ObjectMapper objectMapper;
    private final int capacity;
    private final Duration refillPeriod;
    private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitFilter(
            ObjectMapper objectMapper,
            @Value("${security.rate-limit.auth.capacity:10}") int capacity,
            @Value("${security.rate-limit.auth.refill-period:PT1M}") Duration refillPeriod
    ) {
        this.objectMapper = objectMapper;
        this.capacity = capacity;
        this.refillPeriod = refillPeriod;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String ip = clientIp(req);
        Bucket bucket = buckets.computeIfAbsent(ip, k -> newBucket());
        if (bucket.tryConsume(1)) {
            chain.doFilter(req, res);
            return;
        }

        log.warn("Rate-limited ip={} path={}", ip, req.getRequestURI());
        long retryAfterSeconds = refillPeriod.toSeconds();
        res.setStatus(HttpServletResponse.SC_TOO_MANY_REQUESTS);
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setHeader("Retry-After", Long.toString(retryAfterSeconds));
        ApiErrorResponse body = new ApiErrorResponse(
                "RATE_LIMITED",
                "Too many requests from this IP. Please slow down.",
                "Limit: " + capacity + " per " + refillPeriod,
                OffsetDateTime.now(),
                UUID.randomUUID().toString(),
                Map.of("retryAfterSeconds", retryAfterSeconds)
        );
        res.getWriter().write(objectMapper.writeValueAsString(body));
    }

    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(capacity)
                        .refillGreedy(capacity, refillPeriod)
                        .build())
                .build();
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) return realIp.trim();
        return req.getRemoteAddr();
    }
}
