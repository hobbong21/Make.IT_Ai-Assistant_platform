package com.humanad.makit.observability;

import com.humanad.makit.audit.Auditable;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Metrics aspect that records feature invocation counts and durations to Prometheus.
 * Works in tandem with @Auditable annotation.
 *
 * Metrics emitted:
 * - makit_feature_invocation_total{feature, status} (counter: success|error)
 * - makit_feature_duration_seconds{feature} (timer)
 * - makit_feature_lifecycle_changes_total{from, to} (counter for status changes)
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class MetricsAspect {

    private final MeterRegistry meterRegistry;
    private final Map<String, Counter> lifecycleCounters = new HashMap<>();

    /**
     * Record metrics for methods annotated with @Auditable.
     * Captures invocation count (success/error) and duration.
     */
    @Around("@annotation(auditable)")
    public Object recordAuditableMetrics(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        String resource = auditable.resource();
        if (resource == null || resource.isBlank()) {
            resource = pjp.getTarget().getClass().getSimpleName();
        }

        long startTime = System.currentTimeMillis();
        Throwable capturedEx = null;
        String status = "success";

        try {
            return pjp.proceed();
        } catch (Throwable ex) {
            capturedEx = ex;
            status = "error";
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;

            // Record counter: makit_feature_invocation_total{feature, status}
            String counterKey = "makit_feature_invocation_total:" + resource + ":" + status;
            Counter.builder("makit_feature_invocation_total")
                .tag("feature", resource)
                .tag("status", status)
                .register(meterRegistry)
                .increment();

            // Record timer: makit_feature_duration_seconds{feature}
            Timer.builder("makit_feature_duration_seconds")
                .tag("feature", resource)
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(meterRegistry)
                .record(duration, java.util.concurrent.TimeUnit.MILLISECONDS);

            if (capturedEx != null) {
                log.debug("Metric recorded for {} with status {}", resource, status, capturedEx);
            }
        }
    }

    /**
     * Record feature lifecycle changes (experimental -> beta -> stable -> deprecated).
     * Called from AdminServiceImpl.writeFeatureLifecycleAudit().
     */
    public void recordLifecycleChange(String fromStatus, String toStatus) {
        String counterKey = "makit_feature_lifecycle_changes_total:" + fromStatus + "-" + toStatus;

        Counter.builder("makit_feature_lifecycle_changes_total")
            .tag("from", fromStatus)
            .tag("to", toStatus)
            .register(meterRegistry)
            .increment();
    }
}
