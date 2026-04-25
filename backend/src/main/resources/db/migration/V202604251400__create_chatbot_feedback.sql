-- Create chatbot_feedback table for tracking user feedback on chatbot responses
CREATE TABLE IF NOT EXISTS chatbot_feedback (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_id  VARCHAR(64),
    message_idx INTEGER,
    helpful     BOOLEAN NOT NULL,
    comment     TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient user feedback retrieval
CREATE INDEX IF NOT EXISTS idx_feedback_user ON chatbot_feedback(user_id, created_at DESC);

-- Index for feedback sentiment analysis (helpful vs unhelpful)
CREATE INDEX IF NOT EXISTS idx_feedback_helpful ON chatbot_feedback(helpful);

-- Index for context-based feedback queries
CREATE INDEX IF NOT EXISTS idx_feedback_context ON chatbot_feedback(context_id);
