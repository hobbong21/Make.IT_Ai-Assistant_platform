package com.humanad.makit.ai.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO variant of a chatbot conversation. The persistent entity (ChatSession, ChatMessage)
 * is backend-engineer's concern; the AI layer only consumes this lightweight shape.
 *
 * Kept mutable-list-friendly so implementations can append turn by turn.
 */
public record ConversationContext(
        String contextId,
        UUID userId,
        String sessionId,
        List<Turn> history,
        Instant openedAt,
        Instant lastActiveAt
) {
    public record Turn(
            Role role,
            String content,
            Instant at
    ) {
        public enum Role { USER, ASSISTANT, SYSTEM }
    }
}
