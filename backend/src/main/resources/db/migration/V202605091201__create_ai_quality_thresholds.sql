-- Persists operator-tunable AI quality alert thresholds plus full change history.
--
-- Design: each row is an immutable change event. The "current" effective values
-- are simply the most-recent row (ORDER BY changed_at DESC LIMIT 1). When the
-- table is empty the application falls back to AiQualityProperties (i.e. the
-- yml/env defaults), so an empty table is the canonical "use defaults" state.
--
-- This shape gives us audit trail (누가/언제/무엇) for free without a separate
-- history table, and rollback can be done by inserting a new row that copies a
-- prior set of values.
CREATE TABLE IF NOT EXISTS ai_quality_thresholds (
    id                          BIGSERIAL PRIMARY KEY,
    helpful_rate_threshold      DOUBLE PRECISION NOT NULL,
    latency_mean_alert_ms       DOUBLE PRECISION NOT NULL,
    latency_p95_alert_ms        DOUBLE PRECISION NOT NULL,
    min_samples_for_rate_alert  BIGINT           NOT NULL,
    changed_by_user_id          UUID REFERENCES users(id),
    changed_by_email            VARCHAR(255),
    changed_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    note                        VARCHAR(500),
    CONSTRAINT chk_aiq_helpful_rate CHECK (helpful_rate_threshold >= 0 AND helpful_rate_threshold <= 1),
    CONSTRAINT chk_aiq_latency_mean CHECK (latency_mean_alert_ms >= 0),
    CONSTRAINT chk_aiq_latency_p95  CHECK (latency_p95_alert_ms  >= 0),
    CONSTRAINT chk_aiq_min_samples  CHECK (min_samples_for_rate_alert >= 0)
);

CREATE INDEX IF NOT EXISTS idx_aiq_thresholds_changed_at
    ON ai_quality_thresholds(changed_at DESC);
