package com.humanad.makit.notification;

import java.time.OffsetDateTime;

public record NotificationDto(
    Long id,
    String type,
    String title,
    String message,
    String linkUrl,
    OffsetDateTime readAt,
    OffsetDateTime createdAt
) {
    public static NotificationDto from(Notification entity) {
        return new NotificationDto(
            entity.getId(),
            entity.getType(),
            entity.getTitle(),
            entity.getMessage(),
            entity.getLinkUrl(),
            entity.getReadAt(),
            entity.getCreatedAt()
        );
    }
}
