package com.humanad.makit.notification;

import java.util.UUID;

public interface NotificationService {

    /**
     * Create a notification and push it via WebSocket to the user.
     */
    NotificationDto create(UUID userId, String type, String title, String message, String linkUrl);

    /**
     * Create and send a test notification (for demo/verification purposes).
     */
    NotificationDto sendTestNotification(UUID userId);
}
