package com.humanad.makit.notification.push.analytics;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Push notification analytics event — tracks SENT/DELIVERED/CLICKED/FAILED/EXPIRED.
 */
@Entity
@Table(name = "push_analytics", indexes = {
    @Index(name = "idx_push_analytics_user_created", columnList = "user_id,created_at DESC"),
    @Index(name = "idx_push_analytics_event", columnList = "event_type,created_at DESC")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PushAnalyticsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "subscription_id")
    private Long subscriptionId;

    @Column(name = "notification_id")
    private Long notificationId;

    @Column(nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private EventType eventType;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(columnDefinition = "jsonb")
    private String metadata; // JSON string

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public enum EventType {
        SENT, DELIVERED, CLICKED, FAILED, EXPIRED
    }
}
