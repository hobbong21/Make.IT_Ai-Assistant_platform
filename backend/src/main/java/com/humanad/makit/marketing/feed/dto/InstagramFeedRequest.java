package com.humanad.makit.marketing.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InstagramFeedRequest(
        @NotBlank @Size(max = 4000) String brief,
        BrandTone brandTone,
        String targetAudience,
        String locale,
        Integer hashtagCount,
        Boolean includeImage
) {
    public enum BrandTone { FRIENDLY, LUXURY, PLAYFUL, FORMAL, CASUAL }
}
