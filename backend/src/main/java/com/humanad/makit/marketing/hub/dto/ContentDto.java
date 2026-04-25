package com.humanad.makit.marketing.hub.dto;

import java.time.OffsetDateTime;

public record ContentDto(
    Long id,
    String title,
    String type,
    String thumbnailUrl,
    OffsetDateTime createdAt,
    String serviceKey
) {}
