package com.humanad.makit.commerce.chatbot;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "conversation_contexts", indexes = {
        @Index(name = "idx_contexts_user_activity", columnList = "user_id, last_activity DESC")
})
@Getter @Setter @NoArgsConstructor
public class ConversationContext {

    public enum Status { ACTIVE, CLOSED, EXPIRED }

    @Id
    @Column(name = "context_id", length = 64)
    private String contextId;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "session_id", nullable = false, length = 64)
    private String sessionId;

    @Column(name = "start_time", nullable = false)
    private OffsetDateTime startTime;

    @Column(name = "last_activity", nullable = false)
    private OffsetDateTime lastActivity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "context_variables", columnDefinition = "jsonb")
    private Map<String, Object> contextVariables;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (contextId == null) contextId = UUID.randomUUID().toString();
        if (startTime == null) startTime = now;
        if (lastActivity == null) lastActivity = now;
        if (status == null) status = Status.ACTIVE;
    }
}
