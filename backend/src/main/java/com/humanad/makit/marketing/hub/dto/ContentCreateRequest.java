package com.humanad.makit.marketing.hub.dto;

import jakarta.validation.constraints.NotBlank;

public record ContentCreateRequest(
    @NotBlank(message = "Title is required")
    String title,

    @NotBlank(message = "Type is required")
    String type,

    String thumbnailUrl,

    String serviceKey,

    String body
) {
}
