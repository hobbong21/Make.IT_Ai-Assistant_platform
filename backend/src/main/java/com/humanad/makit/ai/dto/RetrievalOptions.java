package com.humanad.makit.ai.dto;

import java.util.Map;

/**
 * Knobs for a retrieval call.
 *
 * @param topK       max number of chunks to return (default 5).
 * @param threshold  minimum cosine similarity [0,1]; below this -> filtered out (default 0.2).
 * @param filters    metadata equality filters (e.g. "companyId"="abc").
 */
public record RetrievalOptions(
        int topK,
        double threshold,
        Map<String, String> filters
) {
    public static RetrievalOptions defaults() {
        return new RetrievalOptions(5, 0.2, Map.of());
    }

    public RetrievalOptions {
        if (topK <= 0) topK = 5;
        if (threshold < 0 || threshold > 1) threshold = 0.2;
        if (filters == null) filters = Map.of();
    }
}
