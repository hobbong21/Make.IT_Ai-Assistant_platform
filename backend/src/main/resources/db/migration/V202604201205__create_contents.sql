CREATE TABLE IF NOT EXISTS contents (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id),
    campaign_id  BIGINT REFERENCES campaigns(id),
    type         VARCHAR(32) NOT NULL,
    title        VARCHAR(256),
    body         TEXT,
    image_url    VARCHAR(512),
    model_id     VARCHAR(64),
    prompt_hash  CHAR(64),
    status       VARCHAR(16) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_contents_status CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);
CREATE INDEX IF NOT EXISTS idx_contents_user_created ON contents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_campaign ON contents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contents_prompt_hash ON contents(prompt_hash);
