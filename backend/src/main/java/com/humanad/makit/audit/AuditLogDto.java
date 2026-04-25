package com.humanad.makit.audit;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Data Transfer Object for AuditLog entities.
 * Exposes audit log details to REST clients.
 */
public record AuditLogDto(
        Long id,
        String action,
        String resource,
        Map<String, Object> metadata,
        OffsetDateTime createdAt
) {
    /**
     * Map an AuditLog entity to a DTO.
     */
    public static AuditLogDto from(AuditLog entity) {
        return new AuditLogDto(
                entity.getId(),
                entity.getAction(),
                entity.getResource(),
                entity.getMetadata(),
                entity.getCreatedAt()
        );
    }
}
