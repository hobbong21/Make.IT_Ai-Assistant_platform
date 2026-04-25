package com.humanad.makit.marketing.hub.dto;

import jakarta.validation.constraints.NotBlank;

public record CampaignStatusChangeRequest(
    @NotBlank(message = "Status is required") String status
) {}
