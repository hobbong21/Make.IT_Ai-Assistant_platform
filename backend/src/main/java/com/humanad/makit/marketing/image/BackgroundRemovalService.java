package com.humanad.makit.marketing.image;

import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedImage;
import com.humanad.makit.ai.dto.ImageEditRequest;
import com.humanad.makit.common.ExternalServiceException;
import com.humanad.makit.marketing.image.dto.ImageResultResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletionException;

/**
 * Per ADR: Bedrock Stable Diffusion inpainting for v1 — ai-engineer uploads the file
 * to S3, then invokes editImage(REMOVE_BG). Until that pipeline is available this service
 * returns a placeholder URL and flags the TODO.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BackgroundRemovalService {

    private final ContentStrategySelector strategySelector;

    public ImageResultResponse removeBackground(MultipartFile file, String outputFormat) {
        // TODO(ai-engineer): implement S3 upload + Bedrock inpainting. Placeholder returns input metadata only.
        if (file == null || file.isEmpty()) {
            throw new com.humanad.makit.common.ValidationException("Image file is required");
        }
        String fakeUrl = "s3://makit-assets/tmp/" + UUID.randomUUID() + "." + (outputFormat == null ? "png" : outputFormat);
        try {
            ImageEditRequest req = new ImageEditRequest(
                    ImageEditRequest.Operation.REMOVE_BG,
                    fakeUrl,
                    null,
                    null,
                    null, null,
                    UUID.randomUUID(),
                    Map.of()
            );
            ContentGenerationStrategy contentGen = strategySelector.select(ContentType.IMAGE_EDIT);
            GeneratedImage gi = contentGen.editImage(req).join();
            return new ImageResultResponse(
                    gi.imageUrl(),
                    gi.mimeType(),
                    gi.widthPx(),
                    gi.heightPx(),
                    gi.sizeBytes()
            );
        } catch (CompletionException ce) {
            throw new ExternalServiceException("AI_BEDROCK_ERROR", "Background removal failed", ce.getCause());
        } catch (UnsupportedOperationException uoe) {
            log.warn("editImage not yet implemented; returning placeholder");
            return new ImageResultResponse(fakeUrl, "image/" + (outputFormat == null ? "png" : outputFormat), null, null, (long) file.getSize());
        }
    }
}
