-- Push Notification Analytics — track sent/delivered/clicked/failed/expired events
CREATE TABLE IF NOT EXISTS push_analytics (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id   BIGINT REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  notification_id   BIGINT REFERENCES notifications(id) ON DELETE SET NULL,
  event_type        VARCHAR(20) NOT NULL CHECK (event_type IN ('SENT', 'DELIVERED', 'CLICKED', 'FAILED', 'EXPIRED')),
  status_code       INT,
  error_message     TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_analytics_user_created ON push_analytics(user_id, created_at DESC);
CREATE INDEX idx_push_analytics_event ON push_analytics(event_type, created_at DESC);
