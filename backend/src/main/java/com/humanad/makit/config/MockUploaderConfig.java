package com.humanad.makit.config;

import com.humanad.makit.ai.content.S3ImageUploader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Supplies an in-memory stub {@link S3ImageUploader} bean when the {@code mock} profile is active.
 * Lets {@code StableDiffusionImageStrategy} return a stable URL (not a raw {@code data:} URL)
 * in dev/demo runs without AWS credentials.
 *
 * Production profiles (default, docker, prod) should register a real S3-backed implementation
 * — this configuration is profile-gated so it will NOT pollute prod beans.
 */
@Slf4j
@Configuration
@Profile("mock")
public class MockUploaderConfig {

    @Bean
    public S3ImageUploader inMemoryS3ImageUploader() {
        return new InMemoryS3ImageUploader();
    }

    /**
     * Keeps uploaded bytes in memory, keyed by a synthetic object key. The returned
     * URL is a pseudo-S3 path — sufficient for FE rendering in mock mode where the
     * frontend accepts any URL string.
     */
    static final class InMemoryS3ImageUploader implements S3ImageUploader {

        private final ConcurrentMap<String, byte[]> store = new ConcurrentHashMap<>();

        @Override
        public String upload(byte[] bytes, String mimeType, String keyPrefix) {
            String ext = mimeType != null && mimeType.startsWith("image/")
                    ? mimeType.substring("image/".length())
                    : "bin";
            String key = (keyPrefix == null ? "mock" : keyPrefix) + "/" + UUID.randomUUID() + "." + ext;
            store.put(key, bytes == null ? new byte[0] : bytes);
            log.debug("InMemoryS3ImageUploader stored key={} size={} mime={}",
                    key, bytes == null ? 0 : bytes.length, mimeType);
            // Return a data: URL so FE can render without a backing web server.
            String b64 = Base64.getEncoder().encodeToString(
                    bytes == null ? new byte[0] : bytes);
            return "data:" + (mimeType == null ? "application/octet-stream" : mimeType)
                    + ";base64," + b64
                    // Tag so tests / log inspection can see the mock path:
                    + "#mock-key=" + Base64.getUrlEncoder().withoutPadding()
                            .encodeToString(key.getBytes(StandardCharsets.UTF_8));
        }
    }
}
