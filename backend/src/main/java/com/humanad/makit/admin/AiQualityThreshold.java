package com.humanad.makit.admin;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Immutable change-event row backing {@link AiQualityThresholdsService}.
 *
 * <p>Each row is one operator edit; the most-recent row (by {@link #changedAt})
 * is the effective configuration. See the V202605091201 Flyway migration for
 * the rationale behind the event-log layout.
 */
@Entity
@Table(name = "ai_quality_thresholds", indexes = {
        @Index(name = "idx_aiq_thresholds_changed_at", columnList = "changed_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
public class AiQualityThreshold {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "helpful_rate_threshold", nullable = false)
    private double helpfulRateThreshold;

    @Column(name = "latency_mean_alert_ms", nullable = false)
    private double latencyMeanAlertMs;

    @Column(name = "latency_p95_alert_ms", nullable = false)
    private double latencyP95AlertMs;

    @Column(name = "min_samples_for_rate_alert", nullable = false)
    private long minSamplesForRateAlert;

    @Column(name = "changed_by_user_id", columnDefinition = "uuid")
    private UUID changedByUserId;

    @Column(name = "changed_by_email", length = 255)
    private String changedByEmail;

    @Column(name = "changed_at", nullable = false)
    private OffsetDateTime changedAt;

    @Column(name = "note", length = 500)
    private String note;

    @PrePersist
    void onCreate() {
        if (changedAt == null) changedAt = OffsetDateTime.now();
    }
}
