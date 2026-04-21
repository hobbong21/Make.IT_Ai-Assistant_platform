package com.humanad.makit.ai.dto;

import java.time.Instant;
import java.util.List;

/**
 * Non-streaming chatbot reply. Citations come from RAG retrieval; empty when useRag=false.
 */
public record ChatResponse(
        String contextId,
        String reply,
        List<Citation> citations,
        Usage usage,
        String modelId,
        Instant generatedAt
) {
    public record Citation(
            String documentId,
            int chunkIndex,
            double score,
            String snippet
    ) {}

    public record Usage(
            int tokensIn,
            int tokensOut
    ) {}
}
