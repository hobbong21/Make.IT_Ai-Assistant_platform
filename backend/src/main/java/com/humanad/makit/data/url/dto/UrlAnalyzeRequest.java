package com.humanad.makit.data.url.dto;

import jakarta.validation.constraints.NotBlank;

public record UrlAnalyzeRequest(
        @NotBlank String url,
        ExtractMode extractMode
) {
    public enum ExtractMode { READER, FULL_HTML }
}
