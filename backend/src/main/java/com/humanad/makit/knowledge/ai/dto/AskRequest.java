package com.humanad.makit.knowledge.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * AX Office Hub — free-form question over the user's private knowledge base.
 * Mirrors {@code commerce/chatbot} request shape but scoped to the Office Hub
 * collections so callers can wire RAG without sharing chat history with
 * commerce conversations.
 *
 * @param question      user input (1~2,000 chars).
 * @param contextId     optional existing context to continue a thread.
 * @param collectionId  optional filter — restrict retrieval to one collection.
 * @param topK          override default top-K (1~10). null → defaults.
 */
public record AskRequest(
        @NotBlank @Size(max = 2000) String question,
        String contextId,
        String collectionId,
        Integer topK
) {}
