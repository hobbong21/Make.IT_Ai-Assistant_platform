package com.humanad.makit.ai.content;

/**
 * Contract for persisting generated images to S3. Implementation lives outside
 * the ai module (devops/backend provides it) so the ai layer doesn't pull the
 * S3 SDK into its dependency closure beyond what's strictly required.
 *
 * If backend-engineer has not supplied a bean by wiring time, strategies will
 * fall back to returning a data: URL and logging a warning.
 */
public interface S3ImageUploader {

    /**
     * @param bytes     raw image bytes
     * @param mimeType  e.g. image/png
     * @param keyPrefix folder prefix within the bucket (e.g. "generated/modelshot")
     * @return public (or presigned) URL of the uploaded object
     */
    String upload(byte[] bytes, String mimeType, String keyPrefix);
}
