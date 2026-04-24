package com.humanad.makit.commerce.review.dto;

import java.util.List;

public record ReviewAnalysisResponse(
        String productId,
        int reviewCount,
        OverallSentiment overallSentiment,
        List<Theme> themes,
        List<String> improvementPoints
) {
    public record OverallSentiment(double score, String label) {}
    public record Theme(String theme, int frequency, String sentiment) {}
}
