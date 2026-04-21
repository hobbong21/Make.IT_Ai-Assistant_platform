package com.humanad.makit.data.youtube.dto;

import java.util.List;

public record YoutubeKeywordSearchResponse(
        List<String> keywords,
        List<Channel> channels
) {
    public record Channel(
            String channelId,
            String title,
            long subscriberCount,
            double relevanceScore,
            List<String> sampleVideoTitles
    ) {}
}
