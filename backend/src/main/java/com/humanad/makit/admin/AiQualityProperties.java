package com.humanad.makit.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Operator-tunable thresholds for the AI quality dashboard alert banners.
 *
 * <p>Prefix {@code makit.ai.quality} in {@code application.yml}. Every value is
 * overridable via environment variable (Spring's relaxed binding), e.g.
 * {@code MAKIT_AI_QUALITY_LATENCY_P95_ALERT_MS=12000}, so traffic-pattern
 * shifts can be absorbed without a redeploy. See {@code application.yml} for
 * the full set of {@code MAKIT_AI_QUALITY_*} env-var names.
 *
 * <p>Defaults mirror the previously hard-coded constants in
 * {@link AiQualityController}.
 */
@Component
@ConfigurationProperties(prefix = "makit.ai.quality")
public class AiQualityProperties {

    /** helpful 비율이 이 값 미만이면 경고 배너를 띄운다. (0.0 ~ 1.0) */
    private double helpfulRateThreshold = 0.70;

    /** ask 평균 응답시간(ms)이 이 값을 넘으면 경고 배너를 띄운다. */
    private double latencyMeanAlertMs = 6_000.0;

    /** ask p95 응답시간(ms)이 이 값을 넘으면 경고 배너를 띄운다. (꼬리 지연 감지용) */
    private double latencyP95AlertMs = 10_000.0;

    /** 표본이 너무 적으면 helpful-rate 경고는 잠재운다. */
    private long minSamplesForRateAlert = 5;

    public double getHelpfulRateThreshold() { return helpfulRateThreshold; }
    public void setHelpfulRateThreshold(double v) { this.helpfulRateThreshold = v; }

    public double getLatencyMeanAlertMs() { return latencyMeanAlertMs; }
    public void setLatencyMeanAlertMs(double v) { this.latencyMeanAlertMs = v; }

    public double getLatencyP95AlertMs() { return latencyP95AlertMs; }
    public void setLatencyP95AlertMs(double v) { this.latencyP95AlertMs = v; }

    public long getMinSamplesForRateAlert() { return minSamplesForRateAlert; }
    public void setMinSamplesForRateAlert(long v) { this.minSamplesForRateAlert = v; }
}
