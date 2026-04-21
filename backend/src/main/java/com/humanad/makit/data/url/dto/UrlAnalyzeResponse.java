package com.humanad.makit.data.url.dto;

import java.util.List;

public record UrlAnalyzeResponse(
        String url,
        String title,
        String summary,
        List<String> keywords,
        int wordCount,
        String language
) {}
