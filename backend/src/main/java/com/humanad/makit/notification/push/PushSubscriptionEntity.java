package com.humanad.makit.notification.push;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Web Push subscription (VAPID) for OS-level push notifications.
 * Stores endpoint + keys (p256dh, auth) from navigator.serviceWorker.ready.pushManager.subscribe().
 */
@Entity
@Table(name = "push_subscriptions", uniqueConstraints = {
    @UniqueConstraint(columnNames = "endpoint")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscriptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String endpoint;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String p256dh;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String auth;

    @Column(nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
