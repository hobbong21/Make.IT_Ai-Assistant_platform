package com.humanad.makit.marketing.feed.dto;

import java.util.List;

public record InstagramFeedResponse(
        String caption,
        List<String> hashtags,
        String imagePrompt,
        String imageUrl
) {}
