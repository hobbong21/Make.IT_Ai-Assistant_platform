package com.humanad.makit.notification.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Web Push subscription endpoints (VAPID).
 * Clients register/unregister push subscriptions to receive OS-level notifications.
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications/push")
@RequiredArgsConstructor
public class PushSubscriptionController {

    private final PushSubscriptionRepository subscriptionRepository;
    private final VapidConfig vapidConfig;

    /**
     * POST /api/notifications/push/subscribe
     * Register a new push subscription for the authenticated user.
     */
    @PostMapping("/subscribe")
    public ResponseEntity<?> subscribe(
        @RequestBody PushSubscriptionRequest request,
        Authentication auth
    ) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "errorCode", "UNAUTHORIZED",
                "message", "로그인이 필요합니다"
            ));
        }

        try {
            UUID userId = UUID.fromString(auth.getName());

            // Check if already subscribed (endpoint is unique)
            var existing = subscriptionRepository.findByEndpoint(request.endpoint());
            if (existing.isPresent()) {
                log.debug("Subscription already exists for endpoint, updating user_id");
                var entity = existing.get();
                entity.setUserId(userId);
                subscriptionRepository.save(entity);
                return ResponseEntity.ok(Map.of(
                    "id", entity.getId(),
                    "message", "구독이 업데이트되었습니다"
                ));
            }

            // Create new subscription
            PushSubscriptionEntity entity = new PushSubscriptionEntity();
            entity.setUserId(userId);
            entity.setEndpoint(request.endpoint());
            entity.setP256dh(request.keys().p256dh());
            entity.setAuth(request.keys().auth());

            PushSubscriptionEntity saved = subscriptionRepository.save(entity);
            log.info("Push subscription created: id={}, userId={}", saved.getId(), userId);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", saved.getId(),
                "message", "푸시 알림이 활성화되었습니다"
            ));
        } catch (Exception e) {
            log.error("Failed to create push subscription", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "errorCode", "PUSH_SUBSCRIBE_ERROR",
                "message", "구독 등록에 실패했습니다"
            ));
        }
    }

    /**
     * DELETE /api/notifications/push/unsubscribe
     * Unsubscribe from push notifications.
     */
    @DeleteMapping("/unsubscribe")
    public ResponseEntity<?> unsubscribe(
        @RequestParam String endpoint,
        Authentication auth
    ) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                "errorCode", "UNAUTHORIZED",
                "message", "로그인이 필요합니다"
            ));
        }

        try {
            subscriptionRepository.deleteByEndpoint(endpoint);
            log.info("Push subscription deleted for endpoint");
            return ResponseEntity.ok(Map.of(
                "message", "푸시 알림이 비활성화되었습니다"
            ));
        } catch (Exception e) {
            log.error("Failed to delete push subscription", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "errorCode", "PUSH_UNSUBSCRIBE_ERROR",
                "message", "구독 해제에 실패했습니다"
            ));
        }
    }

    /**
     * GET /api/notifications/push/vapid-key
     * Return the public VAPID key for frontend subscription.
     */
    @GetMapping("/vapid-key")
    public ResponseEntity<?> getVapidKey() {
        String publicKey = vapidConfig.getPublicKey();
        if (publicKey == null || publicKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                "errorCode", "PUSH_UNAVAILABLE",
                "message", "푸시 알림이 지원되지 않습니다"
            ));
        }
        return ResponseEntity.ok(Map.of("publicKey", publicKey));
    }
}
