CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    name            VARCHAR(80)  NOT NULL,
    role            VARCHAR(32)  NOT NULL,
    company_id      VARCHAR(64),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    preferences     JSONB,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    version         INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_users_role CHECK (role IN ('ADMIN','MARKETING_MANAGER','CONTENT_CREATOR','ANALYST','VIEWER'))
);

CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
