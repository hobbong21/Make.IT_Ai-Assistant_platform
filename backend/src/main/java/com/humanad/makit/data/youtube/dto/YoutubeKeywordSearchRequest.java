package com.humanad.makit.data.youtube.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record YoutubeKeywordSearchRequest(
        @NotEmpty @Size(max = 10) List<String> keywords,
        String regionCode,
        Integer maxResults
) {}
