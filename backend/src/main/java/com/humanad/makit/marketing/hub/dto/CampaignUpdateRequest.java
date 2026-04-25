package com.humanad.makit.marketing.hub.dto;

import java.time.OffsetDateTime;

/**
 * PATCH request for campaign updates.
 * All fields are nullable — only non-null values are updated.
 */
public record CampaignUpdateRequest(
    String name,
    String description,
    OffsetDateTime startDate,
    OffsetDateTime endDate,
    String channel
) {}
