-- AX Office Hub (Phase 2): collections, documents, tags, favorites, members.
-- Naming uses the `knowledge_*` prefix from task-13 spec but keeps Hub-specific
-- tables under `knowledge_hub_*` to avoid colliding with the existing
-- `knowledge_documents` table used by the RAG retriever (V202604201203).

-- ---------------------------------------------------------------------------
-- Collections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_collections (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name        VARCHAR(120) NOT NULL,
    emoji       VARCHAR(16),
    description VARCHAR(500),
    sort_order  INT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kcol_owner ON knowledge_collections(owner_id);

-- Per-collection role assignments. Default policy = org-wide read; rows here
-- only grant elevated EDITOR/ADMIN privileges. The collection owner is implicit
-- ADMIN and does not require a row.
CREATE TABLE IF NOT EXISTS knowledge_collection_members (
    collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          VARCHAR(16) NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_id, user_id),
    CONSTRAINT chk_kcm_role CHECK (role IN ('ADMIN','EDITOR','VIEWER'))
);
CREATE INDEX IF NOT EXISTS idx_kcm_user ON knowledge_collection_members(user_id);

-- ---------------------------------------------------------------------------
-- Hub documents (separate from RAG `knowledge_documents`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_hub_documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
    owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title         VARCHAR(255) NOT NULL,
    emoji         VARCHAR(16),
    body_md       TEXT NOT NULL DEFAULT '',
    status        VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    deleted_at    TIMESTAMP WITH TIME ZONE,
    search_tsv    tsvector,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    version       INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_khd_status CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED','TRASH'))
);
CREATE INDEX IF NOT EXISTS idx_khd_collection ON knowledge_hub_documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_khd_owner      ON knowledge_hub_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_khd_status     ON knowledge_hub_documents(status);
CREATE INDEX IF NOT EXISTS idx_khd_updated    ON knowledge_hub_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_khd_search     ON knowledge_hub_documents USING GIN(search_tsv);

CREATE OR REPLACE FUNCTION knowledge_hub_documents_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')),   'A')
     || setweight(to_tsvector('simple', coalesce(NEW.body_md, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS knowledge_hub_documents_tsv_trg ON knowledge_hub_documents;
CREATE TRIGGER knowledge_hub_documents_tsv_trg
BEFORE INSERT OR UPDATE OF title, body_md ON knowledge_hub_documents
FOR EACH ROW EXECUTE FUNCTION knowledge_hub_documents_tsv_update();

-- ---------------------------------------------------------------------------
-- Tags (string set per document)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_hub_doc_tags (
    document_id UUID NOT NULL REFERENCES knowledge_hub_documents(id) ON DELETE CASCADE,
    tag         VARCHAR(64) NOT NULL,
    PRIMARY KEY (document_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_khdt_tag ON knowledge_hub_doc_tags(tag);

-- ---------------------------------------------------------------------------
-- Favorites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_hub_favorites (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES knowledge_hub_documents(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, document_id)
);
CREATE INDEX IF NOT EXISTS idx_khf_user ON knowledge_hub_favorites(user_id);
