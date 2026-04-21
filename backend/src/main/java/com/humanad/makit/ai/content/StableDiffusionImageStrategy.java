package com.humanad.makit.ai.content;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.ai.bedrock.BedrockInvocationException;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedContent;
import com.humanad.makit.ai.dto.GeneratedImage;
import com.humanad.makit.ai.dto.ImageEditRequest;
import com.humanad.makit.ai.dto.ImageGenerationRequest;
import com.humanad.makit.ai.dto.ModelInfo;
import com.humanad.makit.ai.dto.TextGenerationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Stable Diffusion XL strategy for IMAGE and IMAGE_EDIT content types.
 * Delegates byte persistence to {@link S3ImageUploader} when available.
 *
 * Bean name: {@code stableDiffusionImageStrategy}.
 */
@Component("stableDiffusionImageStrategy")
public class StableDiffusionImageStrategy implements ContentGenerationStrategy {

    private static final Logger log = LoggerFactory.getLogger(StableDiffusionImageStrategy.class);
    private static final Set<ContentType> SUPPORTED = EnumSet.of(ContentType.IMAGE, ContentType.IMAGE_EDIT);

    private final BedrockClient bedrock;
    private final BedrockProperties props;
    private final ObjectProvider<S3ImageUploader> uploaderProvider;
    private final AsyncTaskExecutor executor;
    private final ObjectMapper om = new ObjectMapper();

    public StableDiffusionImageStrategy(BedrockClient bedrock,
                                        BedrockProperties props,
                                        ObjectProvider<S3ImageUploader> uploaderProvider,
                                        @Qualifier("aiExecutor") AsyncTaskExecutor executor) {
        this.bedrock = bedrock;
        this.props = props;
        this.uploaderProvider = uploaderProvider;
        this.executor = executor;
    }

    @Override
    public CompletableFuture<GeneratedContent> generateText(TextGenerationRequest req) {
        return CompletableFuture.failedFuture(
                new UnsupportedOperationException("SDXL strategy cannot generate text"));
    }

    @Override
    public CompletableFuture<GeneratedImage> generateImage(ImageGenerationRequest req) {
        return CompletableFuture.supplyAsync(() -> doGenerate(req), executor);
    }

    @Override
    public CompletableFuture<GeneratedImage> editImage(ImageEditRequest req) {
        return CompletableFuture.supplyAsync(() -> doEdit(req), executor);
    }

    @Override
    public boolean supports(ContentType type) {
        return SUPPORTED.contains(type);
    }

    @Override
    public ModelInfo getActiveModel(ContentType type) {
        return new ModelInfo(props.models().stableDiffusion(), "stability", type);
    }

    // ----------------------------------------------------------------- impl

    private GeneratedImage doGenerate(ImageGenerationRequest req) {
        String modelId = props.models().stableDiffusion();
        String body = buildSdxlBody(req);
        BedrockInvocation inv = bedrock.invokeImage(modelId, body);
        return parseImageResult(req.requestId(), inv, "generated");
    }

    private GeneratedImage doEdit(ImageEditRequest req) {
        // NOTE: SDXL image-to-image / inpainting uses the same endpoint with init_image/mask fields.
        // Full download/encode of the source image is delegated to backend-engineer —
        // we accept it as base64 in extraParams["initImageBase64"]. If absent, we raise a
        // clear error so callers know what to supply.
        String initBase64 = req.extraParams() == null ? null
                : String.valueOf(req.extraParams().get("initImageBase64"));
        if (initBase64 == null || "null".equals(initBase64) || initBase64.isBlank()) {
            throw new BedrockInvocationException(
                    "ImageEditRequest.extraParams['initImageBase64'] must be provided by caller " +
                    "(backend-engineer fetches from S3 and base64-encodes).");
        }

        String modelId = props.models().stableDiffusion();
        String body = buildSdxlEditBody(req, initBase64);
        BedrockInvocation inv = bedrock.invokeImage(modelId, body);
        return parseImageResult(req.requestId(), inv, "edited");
    }

    // ------------------------------------------------------------ request body

    private String buildSdxlBody(ImageGenerationRequest req) {
        try {
            ObjectNode root = om.createObjectNode();
            ArrayNode prompts = root.putArray("text_prompts");
            ObjectNode pos = prompts.addObject();
            pos.put("text", req.prompt());
            pos.put("weight", 1.0);
            if (req.negativePrompt() != null && !req.negativePrompt().isBlank()) {
                ObjectNode neg = prompts.addObject();
                neg.put("text", req.negativePrompt());
                neg.put("weight", -1.0);
            }
            root.put("cfg_scale", req.cfgScale() != null ? req.cfgScale() : props.defaults().imageCfgScale());
            root.put("steps", req.steps() != null ? req.steps() : props.defaults().imageSteps());
            root.put("width", req.width());
            root.put("height", req.height());
            if (req.seed() != null) root.put("seed", req.seed());
            if (req.stylePreset() != null) root.put("style_preset", req.stylePreset());
            return om.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            throw new BedrockInvocationException("Failed to build SDXL request", e);
        }
    }

    private String buildSdxlEditBody(ImageEditRequest req, String initImageBase64) {
        try {
            ObjectNode root = om.createObjectNode();
            ArrayNode prompts = root.putArray("text_prompts");
            ObjectNode pos = prompts.addObject();
            pos.put("text", req.prompt() != null ? req.prompt() : "photorealistic product on clean background");
            pos.put("weight", 1.0);
            root.put("init_image", initImageBase64);
            root.put("init_image_mode", "IMAGE_STRENGTH");
            root.put("image_strength", 0.35);
            root.put("cfg_scale", props.defaults().imageCfgScale());
            root.put("steps", props.defaults().imageSteps());
            return om.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            throw new BedrockInvocationException("Failed to build SDXL edit request", e);
        }
    }

    // --------------------------------------------------------- response parse

    private GeneratedImage parseImageResult(UUID requestId, BedrockInvocation inv, String prefix) {
        try {
            JsonNode root = om.readTree(inv.rawResponseJson());
            JsonNode artifacts = root.path("artifacts");
            if (!artifacts.isArray() || artifacts.isEmpty()) {
                throw new BedrockInvocationException("SDXL returned no artifacts: " + inv.rawResponseJson());
            }
            JsonNode first = artifacts.get(0);
            String b64 = first.path("base64").asText();
            Long seed = first.has("seed") ? first.get("seed").asLong() : null;

            byte[] bytes = Base64.getDecoder().decode(b64.getBytes(StandardCharsets.UTF_8));
            String url = uploadOrDataUri(bytes, prefix);

            Map<String, Object> meta = new HashMap<>();
            meta.put("finishReason", first.path("finishReason").asText());
            meta.put("latencyMs", inv.latencyMs());

            return new GeneratedImage(
                    requestId != null ? requestId : UUID.randomUUID(),
                    url,
                    "image/png",
                    null, null, (long) bytes.length,
                    inv.modelId(),
                    seed,
                    Instant.now(),
                    meta);
        } catch (BedrockInvocationException e) {
            throw e;
        } catch (Exception e) {
            throw new BedrockInvocationException("Failed to parse SDXL response", e);
        }
    }

    private String uploadOrDataUri(byte[] bytes, String prefix) {
        S3ImageUploader uploader = uploaderProvider.getIfAvailable();
        if (uploader != null) {
            return uploader.upload(bytes, "image/png", prefix);
        }
        log.warn("No S3ImageUploader bean present — returning data: URL. DO NOT use in prod.");
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
    }
}
