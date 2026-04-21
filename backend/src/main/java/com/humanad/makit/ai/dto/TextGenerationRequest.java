package com.humanad.makit.ai.dto;

import java.util.Map;
import java.util.UUID;

/**
 * Generic request for any text-producing model (blog, ad copy, caption, review analysis...).
 *
 * @param type         target ContentType — strategy uses this to select the model + prompt.
 * @param promptKey    classpath-relative prompt under resources/prompts (e.g. "marketing/instagram_caption.md").
 * @param variables    substitution map for {{placeholders}} inside the prompt file.
 * @param systemPrompt optional override of the system role (null -> use prompt file's first block).
 * @param maxTokens    null -> pull default from config.
 * @param temperature  null -> pull default from config.
 * @param requestId    propagated to MDC and metrics tags.
 * @param quality      HIGH -> route to Sonnet, else Haiku. Honored by strategy only where both are configured.
 */
public record TextGenerationRequest(
        ContentType type,
        String promptKey,
        Map<String, Object> variables,
        String systemPrompt,
        Integer maxTokens,
        Double temperature,
        UUID requestId,
        Quality quality
) {
    public enum Quality { STANDARD, HIGH }

    public TextGenerationRequest {
        if (type == null) throw new IllegalArgumentException("type must not be null");
        if (promptKey == null || promptKey.isBlank()) throw new IllegalArgumentException("promptKey required");
        if (variables == null) variables = Map.of();
        if (quality == null) quality = Quality.STANDARD;
    }
}
