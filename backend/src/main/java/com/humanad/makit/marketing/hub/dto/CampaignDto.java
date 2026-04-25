package com.humanad.makit.marketing.hub.dto;

import java.time.OffsetDateTime;

public record CampaignDto(
    Long id,
    String name,
    String status,
    OffsetDateTime startDate,
    OffsetDateTime endDate,
    String channel,
    String description
) {}
