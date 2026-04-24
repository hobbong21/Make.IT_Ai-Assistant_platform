package com.humanad.makit.config;

import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.content.S3ImageUploader;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Real S3-backed {@link S3ImageUploader} implementation that uploads generated
 * images and returns a presigned GET URL (7-day expiry).
 *
 * <p>Activated whenever {@code aws.bedrock.s3.enabled} is {@code true} (default)
 * and no other {@link S3ImageUploader} bean is present — so the
 * {@link MockUploaderConfig} wins under the {@code mock} profile.</p>
 *
 * <p>Retries 5xx / transient failures once (2 attempts total). For multi-region
 * or KMS-encrypted buckets, additional configuration can be added via
 * {@link BedrockProperties.S3}.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "aws.bedrock.s3.enabled", havingValue = "true", matchIfMissing = true)
@ConditionalOnMissingBean(S3ImageUploader.class)
public class DefaultS3ImageUploader implements S3ImageUploader {

    private static final DateTimeFormatter DATE_PATH = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    private static final Duration PRESIGN_TTL = Duration.ofDays(7);

    private final BedrockProperties props;
    private S3Client s3;
    private S3Presigner presigner;

    public DefaultS3ImageUploader(BedrockProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        Region region = Region.of(props.region());
        this.s3 = S3Client.builder()
                .region(region)
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        this.presigner = S3Presigner.builder()
                .region(region)
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        log.info("DefaultS3ImageUploader initialised: bucket={}, region={}, prefix={}",
                props.s3().bucket(), props.region(), props.s3().assetPrefix());
    }

    @PreDestroy
    void close() {
        if (s3 != null) s3.close();
        if (presigner != null) presigner.close();
    }

    @Override
    public String upload(byte[] bytes, String mimeType, String keyPrefix) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("S3 upload bytes must not be empty");
        }
        String ext = extensionFor(mimeType);
        String datePath = LocalDate.now().format(DATE_PATH);
        String objectKey = props.s3().assetPrefix()
                + (keyPrefix == null ? "misc" : keyPrefix) + "/"
                + datePath + "/"
                + UUID.randomUUID() + "." + ext;

        PutObjectRequest put = PutObjectRequest.builder()
                .bucket(props.s3().bucket())
                .key(objectKey)
                .contentType(mimeType == null ? "application/octet-stream" : mimeType)
                .cacheControl("public, max-age=31536000, immutable")
                .build();

        uploadWithRetry(put, bytes, 2);

        PresignedGetObjectRequest presigned = presigner.presignGetObject(
                GetObjectPresignRequest.builder()
                        .signatureDuration(PRESIGN_TTL)
                        .getObjectRequest(GetObjectRequest.builder()
                                .bucket(props.s3().bucket())
                                .key(objectKey)
                                .build())
                        .build());

        URI url = presigned.url() == null ? null : URI.create(presigned.url().toString());
        log.debug("S3 upload OK bucket={} key={} size={} mime={}",
                props.s3().bucket(), objectKey, bytes.length, mimeType);
        return url == null ? null : url.toString();
    }

    private void uploadWithRetry(PutObjectRequest put, byte[] bytes, int attempts) {
        S3Exception last = null;
        for (int i = 1; i <= attempts; i++) {
            try {
                s3.putObject(put, RequestBody.fromBytes(bytes));
                return;
            } catch (S3Exception ex) {
                last = ex;
                int status = ex.statusCode();
                boolean transientErr = status >= 500 || status == 429;
                log.warn("S3 putObject attempt {}/{} failed (status={}, transient={}): {}",
                        i, attempts, status, transientErr, ex.getMessage());
                if (!transientErr) throw ex;
                try {
                    Thread.sleep(200L * i);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw ex;
                }
            }
        }
        throw last != null ? last : S3Exception.builder().message("S3 upload failed").build();
    }

    private static String extensionFor(String mimeType) {
        if (mimeType == null) return "bin";
        return switch (mimeType.toLowerCase()) {
            case "image/png"  -> "png";
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/webp" -> "webp";
            case "image/gif"  -> "gif";
            default -> mimeType.startsWith("image/") ? mimeType.substring("image/".length()) : "bin";
        };
    }
}
