package com.humanad.makit.ai.prompt;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;

/**
 * Operator-driven overrides for prompt variants.
 *
 * <p>application.yml example:
 * <pre>
 *   aws:
 *     bedrock:
 *       rag:
 *         promptVariants:
 *           commerce/rag_system: v2
 *           data/nlp/sentiment: v1
 * </pre>
 *
 * Key: unversioned prompt path (with or without {@code .md}).
 * Value: variant suffix (e.g. {@code v2}) or {@code latest} (= use default).
 */
@Component
@ConfigurationProperties(prefix = "aws.bedrock.rag")
public record PromptVariantProperties(
        Map<String, String> promptVariants
) {

    public PromptVariantProperties {
        promptVariants = promptVariants == null ? Map.of() : Map.copyOf(promptVariants);
    }

    public Map<String, String> variants() {
        return promptVariants == null ? Collections.emptyMap() : promptVariants;
    }

    public static PromptVariantProperties empty() {
        return new PromptVariantProperties(Map.of());
    }
}
