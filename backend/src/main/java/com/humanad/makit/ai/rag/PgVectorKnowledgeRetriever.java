package com.humanad.makit.ai.rag;

import com.humanad.makit.ai.EmbeddingService;
import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.dto.KnowledgeDocumentRef;
import com.humanad.makit.ai.dto.RetrievalOptions;
import com.humanad.makit.ai.dto.RetrievedChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * pgvector-backed retrieval + indexing. Schema assumption (owned by backend-engineer):
 *
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE knowledge_chunks (
 *     id            UUID PRIMARY KEY,
 *     document_id   VARCHAR(64) NOT NULL,
 *     chunk_index   INT NOT NULL,
 *     text          TEXT NOT NULL,
 *     embedding     VECTOR(1024) NOT NULL,
 *     title         TEXT,
 *     source_type   VARCHAR(32),
 *     company_id    VARCHAR(64),
 *     metadata      JSONB,
 *     created_at    TIMESTAMPTZ DEFAULT now()
 *   );
 *   CREATE INDEX knowledge_chunks_embedding_ivfflat
 *     ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 *
 * We intentionally use JdbcTemplate (not JPA) because JPA + pgvector is painful
 * (requires Hibernate UserType extensions and type descriptors).
 */
@Repository
public class PgVectorKnowledgeRetriever implements KnowledgeRetriever {

    private static final Logger log = LoggerFactory.getLogger(PgVectorKnowledgeRetriever.class);

    private final JdbcTemplate jdbc;
    private final EmbeddingService embedder;
    private final TextChunker chunker;

    @Value("${aws.bedrock.rag.chunkSize:1000}")
    private int chunkSize;

    @Value("${aws.bedrock.rag.chunkOverlap:200}")
    private int chunkOverlap;

    public PgVectorKnowledgeRetriever(JdbcTemplate jdbc,
                                      EmbeddingService embedder,
                                      TextChunker chunker) {
        this.jdbc = jdbc;
        this.embedder = embedder;
        this.chunker = chunker;
    }

    // ------------------------------------------------------------- retrieve

    @Override
    public List<RetrievedChunk> retrieve(String query, RetrievalOptions opts) {
        if (query == null || query.isBlank()) return List.of();
        RetrievalOptions o = opts == null ? RetrievalOptions.defaults() : opts;

        float[] q = embedder.embed(query);
        String vecLiteral = toPgVectorLiteral(q);

        // Build dynamic WHERE from filters. Parameter names are keys from a constrained map
        // but we allowlist identifiers against a known set to avoid injection.
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT id, document_id, chunk_index, text, title, source_type, company_id, ")
                .append("       1 - (embedding <=> ?::vector) AS score ")
                .append("  FROM knowledge_chunks ")
                .append(" WHERE 1=1 ");

        List<Object> params = new ArrayList<>();
        params.add(vecLiteral);

        for (Map.Entry<String, String> f : o.filters().entrySet()) {
            String col = whitelistColumn(f.getKey());
            if (col == null) {
                log.warn("Unknown RAG filter key ignored: {}", f.getKey());
                continue;
            }
            sql.append(" AND ").append(col).append(" = ? ");
            params.add(f.getValue());
        }

        sql.append(" ORDER BY embedding <=> ?::vector ")
                .append(" LIMIT ? ");
        params.add(vecLiteral);
        params.add(o.topK());

        try {
            List<RetrievedChunk> rows = jdbc.query(sql.toString(), params.toArray(), (rs, n) -> {
                double score = rs.getDouble("score");
                Map<String, String> meta = new LinkedHashMap<>();
                meta.put("title", nullToEmpty(rs.getString("title")));
                meta.put("sourceType", nullToEmpty(rs.getString("source_type")));
                meta.put("companyId", nullToEmpty(rs.getString("company_id")));
                return new RetrievedChunk(
                        rs.getString("id"),
                        rs.getString("document_id"),
                        rs.getInt("chunk_index"),
                        rs.getString("text"),
                        score,
                        meta);
            });
            // threshold filter
            List<RetrievedChunk> kept = new ArrayList<>(rows.size());
            for (RetrievedChunk c : rows) {
                if (c.score() >= o.threshold()) kept.add(c);
            }
            return kept;
        } catch (DataAccessException e) {
            log.error("pgvector retrieval failed: {}", e.getMessage());
            throw e;
        }
    }

    // --------------------------------------------------------- index / delete

    @Override
    @Transactional
    public void indexDocument(KnowledgeDocumentRef ref, String rawText, Map<String, String> meta) {
        if (ref == null || ref.documentId() == null) throw new IllegalArgumentException("documentId required");
        // Replace strategy: delete existing chunks, then insert new ones.
        jdbc.update("DELETE FROM knowledge_chunks WHERE document_id = ?", ref.documentId());

        List<String> chunks = chunker.split(rawText, chunkSize, chunkOverlap);
        if (chunks.isEmpty()) {
            log.info("indexDocument doc={} produced no chunks", ref.documentId());
            return;
        }

        List<float[]> vectors = embedder.embedBatch(chunks);
        String sql = "INSERT INTO knowledge_chunks " +
                "(id, document_id, chunk_index, text, embedding, title, source_type, company_id) " +
                "VALUES (?, ?, ?, ?, ?::vector, ?, ?, ?)";

        for (int i = 0; i < chunks.size(); i++) {
            final int idx = i;
            final String chunkText = chunks.get(i);
            final String vecLit = toPgVectorLiteral(vectors.get(i));
            jdbc.update((java.sql.Connection con) -> {
                PreparedStatement ps = con.prepareStatement(sql);
                ps.setObject(1, UUID.randomUUID());
                ps.setString(2, ref.documentId());
                ps.setInt(3, idx);
                ps.setString(4, chunkText);
                ps.setString(5, vecLit);
                ps.setString(6, ref.title());
                ps.setString(7, ref.sourceType());
                ps.setString(8, ref.companyId());
                return ps;
            });
        }
        log.info("Indexed document={} chunks={} companyId={}",
                ref.documentId(), chunks.size(), ref.companyId());
    }

    @Override
    @Transactional
    public void deleteDocument(String documentId) {
        int n = jdbc.update("DELETE FROM knowledge_chunks WHERE document_id = ?", documentId);
        log.info("Deleted {} chunks for document={}", n, documentId);
    }

    @Override
    public void reindexAll() {
        // Re-embedding requires access to source raw text, which lives in the commerce
        // module's KnowledgeDocument entity. This implementation only provides the hook;
        // backend-engineer orchestrates the iteration and calls indexDocument per source.
        log.warn("reindexAll() is a no-op in the retriever — orchestration owned by commerce module.");
    }

    // ----------------------------------------------------------- helpers

    /** Format float[] into pgvector literal: "[0.1,0.2,...]". */
    static String toPgVectorLiteral(float[] v) {
        StringBuilder sb = new StringBuilder(v.length * 8 + 2);
        sb.append('[');
        for (int i = 0; i < v.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(Float.toString(v[i]));
        }
        sb.append(']');
        return sb.toString();
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s; }

    private static String whitelistColumn(String filterKey) {
        return switch (filterKey) {
            case "documentId" -> "document_id";
            case "sourceType" -> "source_type";
            case "companyId"  -> "company_id";
            default -> null;
        };
    }
}
