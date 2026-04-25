package com.humanad.makit.ai;

import com.humanad.makit.ai.dto.ChatRequest;
import com.humanad.makit.ai.dto.ChatResponse;
import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.ai.dto.ConversationContext;
import reactor.core.publisher.Flux;

import java.util.UUID;

/**
 * Chatbot engine contract. Sync and streaming flavors share the same underlying
 * retrieval + generation pipeline so SSE and POST /message return equivalent content.
 */
public interface ChatbotEngine {

    ChatResponse chat(ChatRequest req, ConversationContext ctx);

    /** SSE stream of token deltas, citations, final usage, and errors. */
    Flux<ChatStreamChunk> chatStream(ChatRequest req, ConversationContext ctx);

    /** SSE stream variant that accepts an optional page context hint for awareness. */
    Flux<ChatStreamChunk> chatStream(ChatRequest req, ConversationContext ctx, String pageContextHint);

    ConversationContext openContext(UUID userId, String sessionId);

    void closeContext(String contextId);
}
