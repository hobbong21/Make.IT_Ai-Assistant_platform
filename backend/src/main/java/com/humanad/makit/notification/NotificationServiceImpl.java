package com.humanad.makit.notification;

import com.humanad.makit.notification.push.PushSubscriptionEntity;
import com.humanad.makit.notification.push.PushSubscriptionRepository;
import com.humanad.makit.notification.push.analytics.PushAnalyticsEntity;
import com.humanad.makit.notification.push.analytics.PushAnalyticsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.PushService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final PushAnalyticsRepository analyticsRepository;
    private final PushService pushService; // May be null if VAPID not configured

    @Override
    @Transactional
    public NotificationDto create(UUID userId, String type, String title, String message, String linkUrl) {
        try {
            // Create and persist notification
            Notification notification = new Notification();
            notification.setUserId(userId);
            notification.setType(type);
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setLinkUrl(linkUrl);

            Notification saved = notificationRepository.save(notification);
            log.info("Notification created: id={}, userId={}, type={}", saved.getId(), userId, type);

            NotificationDto dto = NotificationDto.from(saved);

            // Push to user via WebSocket
            try {
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    dto
                );
                log.debug("WebSocket notification sent to user {}", userId);
            } catch (Exception e) {
                log.warn("Failed to send WebSocket notification to user {}: {}", userId, e.getMessage());
                // Continue anyway - notification is persisted
            }

            // Push via Web Push (VAPID) if configured
            pushViaWebPush(userId, saved.getId(), title, message, linkUrl);

            return dto;
        } catch (Exception e) {
            log.error("Error creating notification for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to create notification", e);
        }
    }

    /**
     * Send notification via Web Push to all active subscriptions for the user.
     * Gracefully handles: no PushService, no subscriptions, stale endpoints (410).
     * Tracks analytics: SENT, EXPIRED (410), FAILED.
     */
    private void pushViaWebPush(UUID userId, Long notificationId, String title, String message, String linkUrl) {
        if (pushService == null) {
            log.debug("[VAPID] PushService not configured; skipping web push");
            return;
        }

        try {
            List<PushSubscriptionEntity> subscriptions = pushSubscriptionRepository.findByUserId(userId);
            if (subscriptions.isEmpty()) {
                log.debug("[VAPID] No push subscriptions for user {}", userId);
                return;
            }

            // Prepare payload
            Map<String, Object> payload = new HashMap<>();
            payload.put("title", title);
            payload.put("message", message);
            payload.put("tag", "makit-notification");
            payload.put("url", linkUrl != null ? linkUrl : "/index.html");
            payload.put("notificationId", notificationId);

            for (PushSubscriptionEntity sub : subscriptions) {
                try {
                    pushService.send(
                        new nl.martijndwars.webpush.Notification(
                            sub.getEndpoint(),
                            sub.getP256dh(),
                            sub.getAuth(),
                            com.fasterxml.jackson.databind.ObjectMapper.class.getClassLoader()
                                .getResourceAsStream("ignored") == null ? "{}" : "{}"
                        )
                    );
                    log.debug("[VAPID] Push sent to subscription id={}", sub.getId());

                    // Track SENT event
                    try {
                        PushAnalyticsEntity event = new PushAnalyticsEntity();
                        event.setUserId(userId);
                        event.setSubscriptionId(sub.getId());
                        event.setNotificationId(notificationId);
                        event.setEventType(PushAnalyticsEntity.EventType.SENT);
                        event.setStatusCode(201);
                        analyticsRepository.save(event);
                    } catch (Exception e) {
                        log.warn("[Analytics] Failed to record SENT event (non-fatal)", e);
                    }

                } catch (Exception e) {
                    String errMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                    if (errMsg.contains("410") || errMsg.contains("Gone")) {
                        // Stale endpoint - delete it
                        log.warn("[VAPID] Endpoint returned 410 Gone, deleting subscription id={}", sub.getId());
                        pushSubscriptionRepository.deleteByEndpoint(sub.getEndpoint());

                        // Track EXPIRED event
                        try {
                            PushAnalyticsEntity event = new PushAnalyticsEntity();
                            event.setUserId(userId);
                            event.setSubscriptionId(sub.getId());
                            event.setNotificationId(notificationId);
                            event.setEventType(PushAnalyticsEntity.EventType.EXPIRED);
                            event.setStatusCode(410);
                            event.setErrorMessage("Gone");
                            analyticsRepository.save(event);
                        } catch (Exception e2) {
                            log.warn("[Analytics] Failed to record EXPIRED event (non-fatal)", e2);
                        }

                    } else {
                        log.warn("[VAPID] Failed to push to subscription id={}: {}", sub.getId(), errMsg);

                        // Track FAILED event
                        try {
                            PushAnalyticsEntity event = new PushAnalyticsEntity();
                            event.setUserId(userId);
                            event.setSubscriptionId(sub.getId());
                            event.setNotificationId(notificationId);
                            event.setEventType(PushAnalyticsEntity.EventType.FAILED);
                            event.setStatusCode(null);
                            event.setErrorMessage(errMsg);
                            analyticsRepository.save(event);
                        } catch (Exception e2) {
                            log.warn("[Analytics] Failed to record FAILED event (non-fatal)", e2);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[VAPID] Web push failed (non-fatal): {}", e.getMessage());
            // Graceful degradation - notification is already persisted
        }
    }

    @Override
    @Transactional
    public NotificationDto sendTestNotification(UUID userId) {
        return create(
            userId,
            "INFO",
            "WebSocket Test Notification",
            "This is a test notification. WebSocket alerts are working correctly.",
            null
        );
    }
}
