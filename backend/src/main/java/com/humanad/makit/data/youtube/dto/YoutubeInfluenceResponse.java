package com.humanad.makit.data.youtube.dto;

public record YoutubeInfluenceResponse(
        String channelId,
        float influenceScore,
        String tier,
        Metrics metrics
) {
    public record Metrics(
            long subscribers,
            double avgViews,
            double avgEngagementRate,
            double uploadCadenceDays
    ) {}
}
