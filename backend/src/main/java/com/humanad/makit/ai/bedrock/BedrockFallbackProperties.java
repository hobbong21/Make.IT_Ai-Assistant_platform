package com.humanad.makit.ai.bedrock;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Operator overrides for the Tier-2 / Tier-3 fallback cascade used by
 * {@link BedrockService#invokeText}.
 *
 * <pre>
 *   aws:
 *     bedrock:
 *       fallback:
 *         textModel: amazon.titan-text-express-v1
 *         cannedText: "AI 일시 장애 — 잠시 후 다시 시도하세요"
 * </pre>
 *
 * If {@code textModel} is blank, Tier-2 is skipped and the cascade jumps
 * straight from Tier-1 failure to Tier-3 (canned response).
 */
@Component
@ConfigurationProperties(prefix = "aws.bedrock.fallback")
public record BedrockFallbackProperties(
        String textModel,
        String cannedText
) {
    public BedrockFallbackProperties {
        if (cannedText == null || cannedText.isBlank()) {
            cannedText = "AI 일시 장애 — 잠시 후 다시 시도하세요";
        }
    }
}
