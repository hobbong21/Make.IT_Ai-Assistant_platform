package com.humanad.makit.ai.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Result of a text generation call.
 *
 * @param text       raw model output (already JSON-unwrapped by strategy where applicable).
 * @param modelId    concrete model that served the request (e.g. Haiku vs Sonnet after quality routing).
 * @param tokensIn   prompt tokens reported by the model; -1 if provider did not return usage.
 * @param tokensOut  completion tokens; -1 if missing.
 * @param stopReason e.g. "end_turn", "max_tokens".
 * @param metadata   free-form extras (cost estimate, prompt version).
 */
public record GeneratedContent(
        UUID requestId,
        String text,
        String modelId,
        int tokensIn,
        int tokensOut,
        String stopReason,
        Instant generatedAt,
        Map<String, Object> metadata
) {}
