package com.humanad.makit.ai.bedrock;

/**
 * Raw result of a Bedrock call plus parsed metadata. Strategies map this into domain
 * DTOs (GeneratedContent, ChatResponse, etc.). Keeping it internal to the ai module.
 *
 * <p>{@link #stopReason()} values of interest:
 * <ul>
 *   <li>{@code end_turn} / {@code end} — normal completion</li>
 *   <li>{@code fallback} — Tier-3 canned response; inspect {@link #fallbackReason()}</li>
 *   <li>{@code fallback_tier2} — Tier-2 secondary model response</li>
 * </ul>
 */
public record BedrockInvocation(
        String modelId,
        String rawResponseJson,
        String outputText,
        int tokensIn,
        int tokensOut,
        String stopReason,
        long latencyMs,
        boolean fallback,
        String fallbackReason
) {
    /** Back-compat constructor — produces a non-fallback result. */
    public BedrockInvocation(String modelId, String rawResponseJson, String outputText,
                             int tokensIn, int tokensOut, String stopReason, long latencyMs) {
        this(modelId, rawResponseJson, outputText, tokensIn, tokensOut, stopReason, latencyMs,
                false, null);
    }
}
