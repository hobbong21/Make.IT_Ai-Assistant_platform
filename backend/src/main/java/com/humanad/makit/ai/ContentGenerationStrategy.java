package com.humanad.makit.ai;

import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedContent;
import com.humanad.makit.ai.dto.GeneratedImage;
import com.humanad.makit.ai.dto.ImageEditRequest;
import com.humanad.makit.ai.dto.ImageGenerationRequest;
import com.humanad.makit.ai.dto.ModelInfo;
import com.humanad.makit.ai.dto.TextGenerationRequest;

import java.util.concurrent.CompletableFuture;

/**
 * Generic content generation contract. One strategy per provider/modality.
 * Controllers and domain services program against this — never against Bedrock SDK.
 *
 * Signatures are frozen by the architect document (section 3).
 */
public interface ContentGenerationStrategy {

    CompletableFuture<GeneratedContent> generateText(TextGenerationRequest req);

    CompletableFuture<GeneratedImage> generateImage(ImageGenerationRequest req);

    /** Used by background removal and model-shot (inpainting-style) flows. */
    CompletableFuture<GeneratedImage> editImage(ImageEditRequest req);

    boolean supports(ContentType type);

    ModelInfo getActiveModel(ContentType type);
}
