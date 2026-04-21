-- Knowledge base tables (QA-005 aligned with PgVectorKnowledgeRetriever INSERT shape).
-- Parent table: knowledge_documents. Children chunks hold embeddings for RAG retrieval.

CREATE TABLE IF NOT EXISTS knowledge_documents (
    document_id    VARCHAR(64) PRIMARY KEY,
    title          VARCHAR(512) NOT NULL,
    content        TEXT NOT NULL,
    document_type  VARCHAR(32) NOT NULL,
    source         VARCHAR(256),
    tags           TEXT[],
    indexed_at     TIMESTAMP WITH TIME ZONE,
    last_updated   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status         VARCHAR(16) NOT NULL,
    CONSTRAINT chk_kdocs_status CHECK (status IN ('DRAFT','INDEXED','STALE'))
);

CREATE INDEX IF NOT EXISTS idx_kdocs_type ON knowledge_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_kdocs_tags ON knowledge_documents USING GIN(tags);

-- knowledge_chunks — shape matches PgVectorKnowledgeRetriever SELECT/INSERT columns:
--   SELECT: id, document_id, chunk_index, text, title, source_type, company_id, embedding
--   INSERT: id (UUID), document_id, chunk_index, text, embedding, title, source_type, company_id
-- id is UUID (gen_random_uuid requires pgcrypto; installed in V00000001).
-- document_id is VARCHAR(64) to match knowledge_documents.document_id parent column type;
-- the retriever passes String (ref.documentId()) and the FK requires type equivalence.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  VARCHAR(64) NOT NULL REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
    chunk_index  INT NOT NULL,
    text         TEXT NOT NULL,
    embedding    vector(1024) NOT NULL,
    title        VARCHAR(512),
    source_type  VARCHAR(64),
    company_id   VARCHAR(128),
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_kchunks_doc_idx UNIQUE (document_id, chunk_index)
);

-- Vector similarity (cosine) index via IVFFLAT — matches retriever's `embedding <=> ?::vector`.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_ivfflat
    ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document
    ON knowledge_chunks (document_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_company
    ON knowledge_chunks (company_id) WHERE company_id IS NOT NULL;
