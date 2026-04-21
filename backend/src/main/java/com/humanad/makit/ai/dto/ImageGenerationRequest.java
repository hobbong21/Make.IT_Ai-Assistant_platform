package com.humanad.makit.ai.dto;

import java.util.Map;
import java.util.UUID;

/**
 * Image generation request routed to Stable Diffusion XL (or Titan Image fallback).
 *
 * @param prompt       the final prompt (already enhanced by PromptLoader if desired).
 * @param negativePrompt optional — SDXL only.
 * @param width        px
 * @param height       px
 * @param seed         null -> random
 * @param steps        null -> model default
 * @param cfgScale     classifier-free guidance scale; null -> default
 * @param stylePreset  optional SDXL preset (e.g. "photographic", "cinematic")
 * @param requestId    correlation id
 */
public record ImageGenerationRequest(
        String prompt,
        String negativePrompt,
        int width,
        int height,
        Long seed,
        Integer steps,
        Double cfgScale,
        String stylePreset,
        UUID requestId,
        Map<String, Object> extraParams
) {}
