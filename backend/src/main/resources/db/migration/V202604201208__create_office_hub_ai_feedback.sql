-- Office Hub AI feedback (Task #14, Phase 3)
-- Captures 👍/👎 per AI reply so we can monitor citation accuracy and quality.
CREATE TABLE IF NOT EXISTS office_hub_ai_feedback (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id   VARCHAR(64)  NOT NULL,
    document_id  VARCHAR(64),
    user_id      UUID REFERENCES users(id),
    action       VARCHAR(32)  NOT NULL,
    helpful      BOOLEAN      NOT NULL,
    comment      TEXT,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ohaf_context ON office_hub_ai_feedback(context_id);
CREATE INDEX IF NOT EXISTS idx_ohaf_action  ON office_hub_ai_feedback(action);
CREATE INDEX IF NOT EXISTS idx_ohaf_created ON office_hub_ai_feedback(created_at DESC);
