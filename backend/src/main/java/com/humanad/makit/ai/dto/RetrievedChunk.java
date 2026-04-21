package com.humanad.makit.ai.dto;

import java.util.Map;

/**
 * A single retrieval hit from the vector store. `score` is cosine similarity in [0,1]
 * (converted from pgvector's `1 - cosine_distance`).
 */
public record RetrievedChunk(
        String chunkId,
        String documentId,
        int chunkIndex,
        String text,
        double score,
        Map<String, String> metadata
) {}
