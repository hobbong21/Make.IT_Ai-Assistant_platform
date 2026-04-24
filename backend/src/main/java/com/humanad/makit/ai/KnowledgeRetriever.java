package com.humanad.makit.ai;

import com.humanad.makit.ai.dto.KnowledgeDocumentRef;
import com.humanad.makit.ai.dto.RetrievalOptions;
import com.humanad.makit.ai.dto.RetrievedChunk;

import java.util.List;
import java.util.Map;

/**
 * RAG retrieval contract. Persistence layer (pgvector vs OpenSearch in v2)
 * is hidden behind this interface per ADR-001.
 */
public interface KnowledgeRetriever {

    List<RetrievedChunk> retrieve(String query, RetrievalOptions opts);

    /** Chunks, embeds, and stores a source document. */
    void indexDocument(KnowledgeDocumentRef ref, String rawText, Map<String, String> meta);

    void deleteDocument(String documentId);

    /** Admin operation: re-embed and re-insert every known document. */
    void reindexAll();
}
