package com.humanad.makit.knowledge.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CollectionDto(
        UUID id,
        UUID ownerId,
        String name,
        String emoji,
        String description,
        int sortOrder,
        boolean archived,
        long docCount,
        boolean canEdit,
        Double confidenceThreshold,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {}
