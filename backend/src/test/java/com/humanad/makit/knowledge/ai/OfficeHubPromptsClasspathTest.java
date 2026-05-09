package com.humanad.makit.knowledge.ai;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke-test that every Office Hub prompt template referenced by
 * {@link OfficeHubAiService} is present on the classpath and carries the
 * {@code <!-- version: ... -->} header used by {@code PromptLoader} for
 * Micrometer tagging. A missing or unheadered prompt would make
 * {@code PromptLoader#loadVersioned} throw at runtime — this test catches
 * that before deploy.
 */
class OfficeHubPromptsClasspathTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "office_hub_ask.md",
            "office_hub_summarize.md",
            "office_hub_related.md",
            "office_hub_tags.md",
            "office_hub_draft.md"
    })
    void promptIsPresentAndCarriesVersionHeader(String name) throws Exception {
        ClassPathResource res = new ClassPathResource("prompts/knowledge/" + name);

        assertThat(res.exists())
                .as("prompts/knowledge/%s must ship on the classpath", name)
                .isTrue();

        try (var in = res.getInputStream()) {
            String text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            assertThat(text)
                    .as("prompt %s must declare a version header", name)
                    .contains("<!--")
                    .contains("version");
        }
    }
}
