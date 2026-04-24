package com.humanad.makit.ai.bedrock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrock.BedrockClient;
import software.amazon.awssdk.services.bedrock.model.ListFoundationModelsResponse;

import java.time.Duration;
import java.time.Instant;

/**
 * Spring {@link HealthIndicator} for AWS Bedrock reachability.
 *
 * <p>Behaviour:
 * <ul>
 *   <li>{@code aws.bedrock.enabled=false} &rarr; UP with details {@code {mode: "mock"}}</li>
 *   <li>Real {@code ListFoundationModels} succeeds &rarr; UP with {@code modelCount}</li>
 *   <li>Real call fails &rarr; DOWN with exception class + message</li>
 * </ul>
 *
 * <p>The foundation-models list is cached for 60s to avoid hammering the
 * control-plane endpoint every scrape (Actuator/k8s liveness often poll 5-10s).
 *
 * <p>Spring auto-discovers this bean because it implements {@link HealthIndicator} —
 * no explicit registration is required; the endpoint id is derived as
 * {@code bedrock} (class simple name minus "HealthIndicator").
 */
@Component
@EnableConfigurationProperties(BedrockProperties.class)
public class BedrockHealthIndicator implements HealthIndicator {

    private static final Logger log = LoggerFactory.getLogger(BedrockHealthIndicator.class);
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final boolean enabled;
    private final String region;

    private volatile Health cached;
    private volatile Instant cachedAt = Instant.EPOCH;

    // Lazy-built — we only construct the Bedrock control-plane client if enabled.
    private volatile BedrockClient controlClient;

    public BedrockHealthIndicator(
            @Value("${aws.bedrock.enabled:true}") boolean enabled,
            @Value("${aws.bedrock.region:${aws.region:ap-northeast-2}}") String region) {
        this.enabled = enabled;
        this.region = region;
    }

    @Override
    public Health health() {
        if (!enabled) {
            return Health.up().withDetail("mode", "mock").build();
        }
        Health c = cached;
        if (c != null && Instant.now().isBefore(cachedAt.plus(CACHE_TTL))) {
            return c;
        }
        Health fresh = probe();
        cached = fresh;
        cachedAt = Instant.now();
        return fresh;
    }

    private Health probe() {
        try {
            BedrockClient cc = ensureControlClient();
            ListFoundationModelsResponse resp = cc.listFoundationModels(b -> { });
            int count = resp.hasModelSummaries() ? resp.modelSummaries().size() : 0;
            return Health.up()
                    .withDetail("mode", "live")
                    .withDetail("region", region)
                    .withDetail("modelCount", count)
                    .build();
        } catch (Exception e) {
            log.warn("Bedrock health probe failed: {}", e.toString());
            return Health.down()
                    .withDetail("mode", "live")
                    .withDetail("region", region)
                    .withDetail("error", e.getClass().getSimpleName())
                    .withDetail("message", truncate(e.getMessage(), 200))
                    .build();
        }
    }

    private BedrockClient ensureControlClient() {
        BedrockClient local = controlClient;
        if (local != null) return local;
        synchronized (this) {
            if (controlClient == null) {
                controlClient = BedrockClient.builder()
                        .region(Region.of(region))
                        .credentialsProvider(DefaultCredentialsProvider.create())
                        .build();
            }
            return controlClient;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
