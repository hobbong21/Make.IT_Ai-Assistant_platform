package com.humanad.makit.ai.dto;

import java.util.Map;
import java.util.UUID;

/**
 * Image edit request used for background removal and model-shot compositing.
 *
 * @param operation    what to do (REMOVE_BG, INPAINT, OUTPAINT, COMPOSITE)
 * @param sourceImageUrl S3 URL of the image to edit. Strategy downloads if needed.
 * @param maskImageUrl optional mask image (black = keep, white = inpaint).
 * @param prompt       textual instruction for INPAINT/OUTPAINT/COMPOSITE.
 * @param width        target width (null -> preserve source)
 * @param height       target height
 * @param requestId    correlation id
 */
public record ImageEditRequest(
        Operation operation,
        String sourceImageUrl,
        String maskImageUrl,
        String prompt,
        Integer width,
        Integer height,
        UUID requestId,
        Map<String, Object> extraParams
) {
    public enum Operation {
        REMOVE_BG,
        INPAINT,
        OUTPAINT,
        COMPOSITE
    }
}
