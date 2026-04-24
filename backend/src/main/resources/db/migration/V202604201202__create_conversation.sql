CREATE TABLE IF NOT EXISTS conversation_contexts (
    context_id         VARCHAR(64) PRIMARY KEY,
    user_id            UUID NOT NULL REFERENCES users(id),
    session_id         VARCHAR(64) NOT NULL,
    start_time         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status             VARCHAR(16) NOT NULL,
    context_variables  JSONB,
    CONSTRAINT chk_contexts_status CHECK (status IN ('ACTIVE','CLOSED','EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_contexts_user_activity ON conversation_contexts(user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_contexts_status_active ON conversation_contexts(status) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS chat_messages (
    id          BIGSERIAL PRIMARY KEY,
    context_id  VARCHAR(64) NOT NULL REFERENCES conversation_contexts(context_id),
    role        VARCHAR(16) NOT NULL,
    content     TEXT NOT NULL,
    tokens_in   INT,
    tokens_out  INT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_chat_messages_role CHECK (role IN ('USER','ASSISTANT','SYSTEM'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_context_created ON chat_messages(context_id, created_at ASC);
