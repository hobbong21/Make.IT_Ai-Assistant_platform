package com.humanad.makit.data.youtube.dto;

import java.util.List;
import java.util.Map;

public record YoutubeCommentsResponse(
        String videoId,
        int totalAnalyzed,
        Map<String, Double> sentimentDistribution,
        List<Theme> topThemes,
        Double toxicity
) {
    public record Theme(String theme, int count, List<String> sampleComments) {}
}
