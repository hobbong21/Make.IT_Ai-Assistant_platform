package com.humanad.makit.ai.dto;

/**
 * Lightweight identifier returned by ContentGenerationStrategy.getActiveModel.
 * Surface this in response DTOs where callers want to record which model served a request.
 */
public record ModelInfo(
        String modelId,
        String provider,
        ContentType type
) {}
