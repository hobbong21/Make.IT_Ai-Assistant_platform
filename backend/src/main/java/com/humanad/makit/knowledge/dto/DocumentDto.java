package com.humanad.makit.knowledge.dto;

import com.humanad.makit.knowledge.DocStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record DocumentDto(
        UUID id,
        UUID collectionId,
        UUID ownerId,
        String title,
        String emoji,
        String bodyMd,
        DocStatus status,
        List<String> tags,
        boolean favorite,
        boolean canEdit,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OffsetDateTime deletedAt
) {}
