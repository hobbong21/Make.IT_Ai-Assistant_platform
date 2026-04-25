-- Create indexes to support dashboard queries efficiently

-- Index for user count queries
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Index for user's cumulative request count aggregation
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- Index for user's active job count
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON job_executions(user_id, status)
    WHERE status IN ('PENDING', 'RUNNING');

-- Index for top services aggregation by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, created_at DESC);
