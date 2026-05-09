package com.humanad.makit.knowledge.ai;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persisted user feedback on an Office Hub AI reply. Powers the
 * "사용자 피드백 모니터링" acceptance criteria from Task #14.
 */
@Entity
@Table(name = "office_hub_ai_feedback", indexes = {
        @Index(name = "idx_ohaf_context", columnList = "context_id"),
        @Index(name = "idx_ohaf_action",  columnList = "action")
})
@Getter @Setter @NoArgsConstructor
public class OfficeHubFeedback {

    @Id
    @GeneratedValue
    @Column(name = "id", columnDefinition = "uuid")
    private UUID id;

    @Column(name = "context_id", nullable = false, length = 64)
    private String contextId;

    @Column(name = "document_id", length = 64)
    private String documentId;

    @Column(name = "user_id", columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false, length = 32)
    private String action;

    @Column(nullable = false)
    private boolean helpful;

    @Column(columnDefinition = "text")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
