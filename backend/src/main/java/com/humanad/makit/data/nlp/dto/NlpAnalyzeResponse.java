package com.humanad.makit.data.nlp.dto;

import java.util.List;

public record NlpAnalyzeResponse(
        Sentiment sentiment,
        List<Entity> entities,
        List<String> keywords,
        String summary,
        String category,
        String model
) {
    public record Sentiment(String label, float score) {}
    public record Entity(String text, String type, double score) {}
}
