CREATE TABLE IF NOT EXISTS reviews (
    id                 BIGSERIAL PRIMARY KEY,
    product_id         VARCHAR(64) NOT NULL,
    user_id            UUID REFERENCES users(id),
    rating             SMALLINT NOT NULL,
    body               TEXT NOT NULL,
    sentiment          VARCHAR(16),
    sentiment_score    NUMERIC(6,4),
    keywords           TEXT[],
    improvement_points TEXT[],
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment);
CREATE INDEX IF NOT EXISTS idx_reviews_keywords ON reviews USING GIN(keywords);
