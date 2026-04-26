package com.humanad.makit.marketing.hub.dto;

public record ContentUpdateRequest(
    String title,
    String type,
    String thumbnailUrl,
    String serviceKey,
    String body
) {
}
