package com.humanad.makit.commerce.chatbot;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Chatbot feedback entity — tracks user feedback (thumbs up/down) on chatbot responses.
 * Used for quality monitoring, model evaluation, and UX improvements.
 */
@Entity
@Table(name = "chatbot_feedback", indexes = {
        @Index(name = "idx_feedback_user", columnList = "user_id, created_at DESC"),
        @Index(name = "idx_feedback_helpful", columnList = "helpful"),
        @Index(name = "idx_feedback_context", columnList = "context_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", columnDefinition = "uuid", nullable = false)
    private UUID userId;

    @Column(name = "context_id", length = 64)
    private String contextId;

    @Column(name = "message_idx")
    private Integer messageIdx;

    @Column(nullable = false)
    private Boolean helpful;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
