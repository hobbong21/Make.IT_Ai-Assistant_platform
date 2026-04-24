package com.humanad.makit.ai.dto;

import java.util.UUID;

/**
 * Chatbot request — maps 1:1 from the API's ChatMessageRequest but decoupled so
 * the AI layer doesn't depend on commerce DTOs.
 */
public record ChatRequest(
        UUID requestId,
        String message,
        String contextId,
        boolean useRag,
        Double temperature,
        Integer maxTokens
) {}
