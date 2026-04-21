package com.humanad.makit.ai.content;

import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedContent;
import com.humanad.makit.ai.dto.GeneratedImage;
import com.humanad.makit.ai.dto.ImageEditRequest;
import com.humanad.makit.ai.dto.ImageGenerationRequest;
import com.humanad.makit.ai.dto.ModelInfo;
import com.humanad.makit.ai.dto.TextGenerationRequest;
import com.humanad.makit.ai.prompt.PromptLoader;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Text generation strategy backed by Anthropic Claude (Haiku default, Sonnet for HIGH quality).
 * Handles blog posts, ad copy, Instagram captions, email templates.
 *
 * Bean name: {@code claudeTextContentStrategy}. Inject as List<ContentGenerationStrategy>
 * and pick by .supports(type).
 */
@Component("claudeTextContentStrategy")
public class ClaudeTextContentStrategy implements ContentGenerationStrategy {

    private static final Set<ContentType> SUPPORTED = EnumSet.of(
            ContentType.BLOG_POST,
            ContentType.AD_COPY,
            ContentType.INSTAGRAM_CAPTION,
            ContentType.EMAIL_TEMPLATE,
            ContentType.MULTIMODAL
    );

    private final BedrockClient bedrock;
    private final BedrockProperties props;
    private final PromptLoader prompts;
    private final AsyncTaskExecutor executor;

    public ClaudeTextContentStrategy(BedrockClient bedrock,
                                     BedrockProperties props,
                                     PromptLoader prompts,
                                     @Qualifier("aiExecutor") AsyncTaskExecutor executor) {
        this.bedrock = bedrock;
        this.props = props;
        this.prompts = prompts;
        this.executor = executor;
    }

    @Override
    public CompletableFuture<GeneratedContent> generateText(TextGenerationRequest req) {
        return CompletableFuture.supplyAsync(() -> doGenerate(req), executor);
    }

    private GeneratedContent doGenerate(TextGenerationRequest req) {
        String modelId = pickModel(req.quality());
        String rendered = prompts.load(req.promptKey(), req.variables());

        // Split on first "---\n" if prompt file provides an explicit system/user split.
        // Convention: leading <!-- system: true --> block before "---\n" becomes systemPrompt.
        String systemPrompt = req.systemPrompt();
        String userPrompt = rendered;
        int split = rendered.indexOf("\n---\n");
        if (systemPrompt == null && split > 0) {
            systemPrompt = rendered.substring(0, split).trim();
            userPrompt = rendered.substring(split + 5).trim();
        }

        BedrockInvocation inv = bedrock.invokeText(
                modelId,
                userPrompt,
                systemPrompt,
                req.maxTokens(),
                req.temperature());

        Map<String, Object> meta = new HashMap<>();
        meta.put("latencyMs", inv.latencyMs());
        meta.put("stopReason", inv.stopReason());
        meta.put("promptKey", req.promptKey());
        meta.put("quality", req.quality());

        return new GeneratedContent(
                req.requestId() != null ? req.requestId() : UUID.randomUUID(),
                inv.outputText() == null ? "" : inv.outputText().trim(),
                inv.modelId(),
                inv.tokensIn(),
                inv.tokensOut(),
                inv.stopReason(),
                Instant.now(),
                meta);
    }

    @Override
    public CompletableFuture<GeneratedImage> generateImage(ImageGenerationRequest req) {
        return CompletableFuture.failedFuture(
                new UnsupportedOperationException("Claude text strategy cannot generate images"));
    }

    @Override
    public CompletableFuture<GeneratedImage> editImage(ImageEditRequest req) {
        return CompletableFuture.failedFuture(
                new UnsupportedOperationException("Claude text strategy cannot edit images"));
    }

    @Override
    public boolean supports(ContentType type) {
        return SUPPORTED.contains(type);
    }

    @Override
    public ModelInfo getActiveModel(ContentType type) {
        return new ModelInfo(props.models().claudeHaiku(), "anthropic", type);
    }

    private String pickModel(TextGenerationRequest.Quality quality) {
        if (quality == TextGenerationRequest.Quality.HIGH) {
            return props.models().claudeSonnet();
        }
        return props.models().claudeHaiku();
    }
}
