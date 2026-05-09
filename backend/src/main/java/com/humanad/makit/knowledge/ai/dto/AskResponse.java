package com.humanad.makit.knowledge.ai.dto;

import java.time.Instant;
import java.util.List;

/**
 * Non-streaming reply for {@code POST /api/knowledge/ai/ask}.
 * The {@link Citation#documentId()} maps 1:1 to the front-end's
 * {@code #doc/<id>} hash route so clicking a citation navigates to source.
 */
public record AskResponse(
        String contextId,
        String answer,
        List<Citation> citations,
        Usage usage,
        String modelId,
        Instant generatedAt
) {
    public record Citation(
            String documentId,
            String title,
            int chunkIndex,
            double score,
            String snippet
    ) {}

    public record Usage(int tokensIn, int tokensOut) {}
}
