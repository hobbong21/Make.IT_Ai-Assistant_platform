package com.humanad.makit.data.nlp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record NlpAnalyzeRequest(
        @NotBlank @Size(max = 20000) String text,
        List<NlpTask> tasks,
        String language
) {
    public enum NlpTask { SENTIMENT, ENTITIES, KEYWORDS, SUMMARY, CATEGORY }
}
