package com.humanad.makit.marketing.hub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record CampaignCreateRequest(
    @NotBlank(message = "Campaign name is required") String name,
    String description,
    @NotNull(message = "Channel is required") String channel,
    OffsetDateTime startDate,
    OffsetDateTime endDate
) {}
