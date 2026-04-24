CREATE TABLE IF NOT EXISTS campaigns (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id),
    name         VARCHAR(128) NOT NULL,
    description  TEXT,
    status       VARCHAR(16) NOT NULL,
    start_date   DATE,
    end_date     DATE,
    budget       NUMERIC(14,2),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_campaigns_status CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ENDED'))
);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_status ON campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status_end ON campaigns(status, end_date);

CREATE TABLE IF NOT EXISTS campaign_analytics (
    id             BIGSERIAL PRIMARY KEY,
    campaign_id    BIGINT NOT NULL REFERENCES campaigns(id),
    report_date    DATE NOT NULL,
    impressions    NUMERIC(14,2) NOT NULL DEFAULT 0,
    clicks         NUMERIC(14,2) NOT NULL DEFAULT 0,
    conversions    NUMERIC(14,2) NOT NULL DEFAULT 0,
    cost           NUMERIC(14,2) NOT NULL DEFAULT 0,
    revenue        NUMERIC(14,2) NOT NULL DEFAULT 0,
    ctr            NUMERIC(8,4),
    cvr            NUMERIC(8,4),
    roas           NUMERIC(10,4),
    calculated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT uk_campaign_analytics_campaign_date UNIQUE (campaign_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_report_date ON campaign_analytics(report_date DESC);
