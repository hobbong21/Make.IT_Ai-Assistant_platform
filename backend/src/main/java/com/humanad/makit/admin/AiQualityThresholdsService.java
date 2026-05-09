package com.humanad.makit.admin;

import com.humanad.makit.auth.User;
import com.humanad.makit.auth.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Reads/writes the operator-tunable AI quality alert thresholds.
 *
 * <p>Source of truth is the {@code ai_quality_thresholds} table (latest row
 * wins). When the table is empty we fall back to {@link AiQualityProperties}
 * — i.e. the {@code makit.ai.quality.*} yml/env defaults. This keeps existing
 * deployments working without a forced one-time seed.
 *
 * <p>The effective values are cached in an {@link AtomicReference} so the hot
 * read path (every {@code /api/admin/ai/quality} call) does not hit the DB.
 * The cache is refreshed on startup and on every successful update.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiQualityThresholdsService {

    private final AiQualityThresholdRepository repo;
    private final AiQualityProperties defaults;
    private final UserRepository userRepo;

    private final AtomicReference<EffectiveThresholds> cache = new AtomicReference<>();

    @PostConstruct
    void load() {
        cache.set(readFromDbOrDefaults());
    }

    /** Currently effective thresholds (cached). Never null. */
    public EffectiveThresholds current() {
        EffectiveThresholds v = cache.get();
        return v != null ? v : readFromDbOrDefaults();
    }

    /**
     * Persist a new set of thresholds and return the resulting effective row.
     * Also refreshes the in-memory cache. The caller is responsible for the
     * ADMIN authorization check (the controller enforces {@code @PreAuthorize}).
     */
    @Transactional
    public EffectiveThresholds update(UpdateRequest req, UUID actorUserId) {
        validate(req);
        AiQualityThreshold row = new AiQualityThreshold();
        row.setHelpfulRateThreshold(req.helpfulRateThreshold());
        row.setLatencyMeanAlertMs(req.latencyMeanAlertMs());
        row.setLatencyP95AlertMs(req.latencyP95AlertMs());
        row.setMinSamplesForRateAlert(req.minSamplesForRateAlert());
        row.setChangedByUserId(actorUserId);
        row.setChangedByEmail(actorUserId == null ? null
                : userRepo.findById(actorUserId).map(User::getEmail).orElse(null));
        row.setNote(req.note());
        AiQualityThreshold saved = repo.save(row);

        EffectiveThresholds eff = toEffective(saved, "DB");
        cache.set(eff);
        log.info("AI quality thresholds updated by {} → helpful>={}, mean<={}ms, p95<={}ms, minSamples>={}",
                row.getChangedByEmail(), saved.getHelpfulRateThreshold(),
                saved.getLatencyMeanAlertMs(), saved.getLatencyP95AlertMs(),
                saved.getMinSamplesForRateAlert());
        return eff;
    }

    /** Newest-first change history (max 100 rows). */
    public List<HistoryEntry> history(int limit) {
        int n = Math.min(100, Math.max(1, limit));
        return repo.findAllByOrderByChangedAtDescIdDesc(PageRequest.of(0, n))
                .stream()
                .map(r -> new HistoryEntry(
                        r.getId(),
                        r.getHelpfulRateThreshold(),
                        r.getLatencyMeanAlertMs(),
                        r.getLatencyP95AlertMs(),
                        r.getMinSamplesForRateAlert(),
                        r.getChangedByUserId(),
                        r.getChangedByEmail(),
                        r.getChangedAt(),
                        r.getNote()))
                .toList();
    }

    // -------------------------------------------------------------- internals

    private EffectiveThresholds readFromDbOrDefaults() {
        Optional<AiQualityThreshold> latest = repo.findFirstByOrderByChangedAtDescIdDesc();
        return latest.map(r -> toEffective(r, "DB"))
                .orElseGet(() -> new EffectiveThresholds(
                        defaults.getHelpfulRateThreshold(),
                        defaults.getLatencyMeanAlertMs(),
                        defaults.getLatencyP95AlertMs(),
                        defaults.getMinSamplesForRateAlert(),
                        null, null, null, "DEFAULTS"));
    }

    private static EffectiveThresholds toEffective(AiQualityThreshold r, String source) {
        return new EffectiveThresholds(
                r.getHelpfulRateThreshold(),
                r.getLatencyMeanAlertMs(),
                r.getLatencyP95AlertMs(),
                r.getMinSamplesForRateAlert(),
                r.getChangedByUserId(),
                r.getChangedByEmail(),
                r.getChangedAt(),
                source);
    }

    private static void validate(UpdateRequest req) {
        if (req == null) throw new IllegalArgumentException("request body is required");
        if (req.helpfulRateThreshold() < 0.0 || req.helpfulRateThreshold() > 1.0) {
            throw new IllegalArgumentException("helpfulRateThreshold must be between 0.0 and 1.0");
        }
        if (req.latencyMeanAlertMs() < 0.0) {
            throw new IllegalArgumentException("latencyMeanAlertMs must be >= 0");
        }
        if (req.latencyP95AlertMs() < 0.0) {
            throw new IllegalArgumentException("latencyP95AlertMs must be >= 0");
        }
        if (req.minSamplesForRateAlert() < 0) {
            throw new IllegalArgumentException("minSamplesForRateAlert must be >= 0");
        }
        if (req.note() != null && req.note().length() > 500) {
            throw new IllegalArgumentException("note must be <= 500 characters");
        }
    }

    // ----------------------------------------------------------------- DTOs

    /** Request payload for {@link #update}. */
    public record UpdateRequest(
            double helpfulRateThreshold,
            double latencyMeanAlertMs,
            double latencyP95AlertMs,
            long minSamplesForRateAlert,
            String note) {}

    /**
     * Currently effective thresholds. {@code source} is {@code "DB"} when an
     * operator override is in effect or {@code "DEFAULTS"} when falling back
     * to {@link AiQualityProperties}.
     */
    public record EffectiveThresholds(
            double helpfulRateThreshold,
            double latencyMeanAlertMs,
            double latencyP95AlertMs,
            long minSamplesForRateAlert,
            UUID changedByUserId,
            String changedByEmail,
            OffsetDateTime changedAt,
            String source) {}

    /** One row of change history. */
    public record HistoryEntry(
            Long id,
            double helpfulRateThreshold,
            double latencyMeanAlertMs,
            double latencyP95AlertMs,
            long minSamplesForRateAlert,
            UUID changedByUserId,
            String changedByEmail,
            OffsetDateTime changedAt,
            String note) {}
}
