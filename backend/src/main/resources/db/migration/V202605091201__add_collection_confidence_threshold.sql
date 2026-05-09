-- Task #36: per-collection AI confidence threshold override.
-- NULL = inherit user/global setting; otherwise 0.0–1.0 fraction.
ALTER TABLE knowledge_collections
    ADD COLUMN IF NOT EXISTS confidence_threshold REAL;

ALTER TABLE knowledge_collections
    DROP CONSTRAINT IF EXISTS chk_kcol_conf_threshold;
ALTER TABLE knowledge_collections
    ADD CONSTRAINT chk_kcol_conf_threshold
    CHECK (confidence_threshold IS NULL
           OR (confidence_threshold >= 0.0 AND confidence_threshold <= 1.0));
