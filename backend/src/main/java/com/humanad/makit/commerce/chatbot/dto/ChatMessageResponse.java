package com.humanad.makit.commerce.chatbot.dto;

import java.util.List;

public record ChatMessageResponse(
        String contextId,
        String reply,
        String role,
        List<Citation> citations,
        Usage usage
) {
    public record Citation(String documentId, int chunkIndex, double score, String snippet) {}
    public record Usage(int tokensIn, int tokensOut) {}
}
