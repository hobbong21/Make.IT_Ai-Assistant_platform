package com.humanad.makit.ai;

import com.humanad.makit.ai.dto.ContentType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Resolves the correct {@link ContentGenerationStrategy} bean for a given {@link ContentType}.
 *
 * Backend services inject this selector rather than a single strategy bean, because
 * there are multiple {@link ContentGenerationStrategy} beans (Claude text, Stable Diffusion image)
 * and none is marked {@code @Primary}. Injecting the interface directly would cause
 * {@code NoUniqueBeanDefinitionException} at startup.
 *
 * Contract matches the ai-engineer's guidance in 03_ai_progress.md:
 * "inject as List&lt;ContentGenerationStrategy&gt; and pick by .supports(type)".
 */
@Component
@RequiredArgsConstructor
public class ContentStrategySelector {

    private final List<ContentGenerationStrategy> strategies;

    /**
     * Returns the first strategy whose {@code supports(type)} returns true.
     *
     * @throws IllegalStateException if no strategy handles the given type.
     */
    public ContentGenerationStrategy select(ContentType type) {
        return strategies.stream()
                .filter(s -> s.supports(type))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No ContentGenerationStrategy registered for ContentType=" + type));
    }
}
