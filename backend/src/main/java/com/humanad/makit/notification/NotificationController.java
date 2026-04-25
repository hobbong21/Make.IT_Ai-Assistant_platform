package com.humanad.makit.notification;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping("/me")
    @Operation(summary = "Get paginated notifications for authenticated user")
    public ResponseEntity<Page<NotificationDto>> getNotifications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UUID userId = currentUserId();
        if (size > 100) size = 100;
        Pageable pageable = PageRequest.of(page, size);
        Page<Notification> notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return ResponseEntity.ok(notifications.map(NotificationDto::from));
    }

    @GetMapping("/me/unread-count")
    @Operation(summary = "Get unread notification count for authenticated user")
    public ResponseEntity<Map<String, Long>> getUnreadCount() {
        UUID userId = currentUserId();
        long count = notificationRepository.countByUserIdAndReadAtIsNull(userId);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @PostMapping("/me/read-all")
    @Transactional
    @Operation(summary = "Mark all notifications as read for authenticated user")
    public ResponseEntity<Map<String, Long>> markAllRead() {
        UUID userId = currentUserId();
        int updated = notificationRepository.markAllRead(userId);
        return ResponseEntity.ok(Map.of("updated", (long) updated));
    }

    @PostMapping("/{id}/read")
    @Transactional
    @Operation(summary = "Mark specific notification as read")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        UUID userId = currentUserId();
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (!notification.getUserId().equals(userId)) {
            return ResponseEntity.status(403).build();
        }

        notification.setReadAt(java.time.OffsetDateTime.now());
        notificationRepository.save(notification);
        return ResponseEntity.ok().build();
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return UUID.fromString(auth.getName());
    }
}
