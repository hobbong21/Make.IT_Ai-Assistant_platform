CREATE TABLE IF NOT EXISTS job_executions (
    job_id         UUID PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id),
    domain         VARCHAR(16) NOT NULL,
    operation      VARCHAR(64) NOT NULL,
    status         VARCHAR(16) NOT NULL,
    input          JSONB NOT NULL,
    output         JSONB,
    error_message  TEXT,
    started_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at   TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_jobs_domain CHECK (domain IN ('data','marketing','commerce')),
    CONSTRAINT chk_jobs_status CHECK (status IN ('PENDING','RUNNING','SUCCESS','FAILED'))
);
CREATE INDEX IF NOT EXISTS idx_jobs_user_started ON job_executions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_pending_running ON job_executions(status) WHERE status IN ('PENDING','RUNNING');
CREATE INDEX IF NOT EXISTS idx_jobs_domain_op ON job_executions(domain, operation);
