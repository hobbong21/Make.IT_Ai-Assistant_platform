package com.humanad.makit.ai.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Image generation/edit result.
 *
 * NOTE: Per skill rules, base64 bytes are NOT persisted to DB. The strategy is
 * responsible for uploading to S3 and returning the resulting URL here.
 *
 * @param imageUrl   S3 URL (already uploaded by strategy).
 * @param mimeType   image/png, image/jpeg, image/webp
 * @param widthPx    actual width
 * @param heightPx   actual height
 * @param sizeBytes  object size
 * @param modelId    which model produced the image
 * @param seed       if the model reported seed (reproducibility)
 */
public record GeneratedImage(
        UUID requestId,
        String imageUrl,
        String mimeType,
        Integer widthPx,
        Integer heightPx,
        Long sizeBytes,
        String modelId,
        Long seed,
        Instant generatedAt,
        Map<String, Object> metadata
) {}
