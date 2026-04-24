package com.humanad.makit.marketing.image.dto;

public record ImageResultResponse(
        String imageUrl,
        String mimeType,
        Integer widthPx,
        Integer heightPx,
        Long sizeBytes
) {}
