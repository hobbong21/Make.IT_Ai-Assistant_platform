package com.humanad.makit.meetingnotes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.humanad.makit.meetingnotes.dto.TranscribeResponse;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.transcribe.TranscribeClient;
import software.amazon.awssdk.services.transcribe.model.DeleteTranscriptionJobRequest;
import software.amazon.awssdk.services.transcribe.model.GetTranscriptionJobRequest;
import software.amazon.awssdk.services.transcribe.model.LanguageCode;
import software.amazon.awssdk.services.transcribe.model.Media;
import software.amazon.awssdk.services.transcribe.model.MediaFormat;
import software.amazon.awssdk.services.transcribe.model.StartTranscriptionJobRequest;
import software.amazon.awssdk.services.transcribe.model.Settings;
import software.amazon.awssdk.services.transcribe.model.TranscriptionJob;
import software.amazon.awssdk.services.transcribe.model.TranscriptionJobStatus;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

/**
 * Server-side speech-to-text using AWS Transcribe (batch).
 *
 * <p>Flow:
 * <ol>
 *   <li>Upload the uploaded audio blob to S3 under a temporary {@code transcribe/} prefix.</li>
 *   <li>Start a {@link StartTranscriptionJobRequest} pointing at that S3 object.</li>
 *   <li>Poll the job until COMPLETED / FAILED (max ~3 min).</li>
 *   <li>Download the transcript JSON from the AWS-hosted result URI, extract
 *       {@code results.transcripts[0].transcript}.</li>
 *   <li>Best-effort delete the temporary S3 object.</li>
 * </ol>
 *
 * <p>Required environment / properties (defaults pull from existing AWS config):
 * <ul>
 *   <li>{@code aws.region} — region for both S3 and Transcribe (must be the same)</li>
 *   <li>{@code aws.transcribe.bucket} — S3 bucket for temp uploads;
 *       falls back to {@code aws.bedrock.s3.bucket}</li>
 *   <li>{@code aws.transcribe.prefix} — key prefix (default {@code transcribe/})</li>
 * </ul>
 *
 * <p>IAM role/credentials must allow: {@code s3:PutObject}, {@code s3:GetObject},
 * {@code s3:DeleteObject} on the bucket, and {@code transcribe:StartTranscriptionJob} +
 * {@code transcribe:GetTranscriptionJob}.</p>
 */
@Slf4j
@Service
public class TranscribeService {

    private static final Duration POLL_INTERVAL = Duration.ofSeconds(3);
    private static final Duration POLL_TIMEOUT = Duration.ofMinutes(3);

    private final String region;
    private final String bucket;
    private final String prefix;
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private S3Client s3;
    private TranscribeClient transcribe;

    public TranscribeService(
            @Value("${aws.region:ap-northeast-2}") String region,
            @Value("${aws.transcribe.bucket:${aws.bedrock.s3.bucket:}}") String bucket,
            @Value("${aws.transcribe.prefix:transcribe/}") String prefix
    ) {
        this.region = region;
        this.bucket = bucket;
        this.prefix = prefix.endsWith("/") ? prefix : prefix + "/";
    }

    @PostConstruct
    void init() {
        if (bucket == null || bucket.isBlank()) {
            log.warn("TranscribeService: no bucket configured (aws.transcribe.bucket); /transcribe will fail until set");
        }
        Region r = Region.of(region);
        this.s3 = S3Client.builder()
                .region(r)
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        this.transcribe = TranscribeClient.builder()
                .region(r)
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
        log.info("TranscribeService initialised: region={}, bucket={}, prefix={}", region, bucket, prefix);
    }

    @PreDestroy
    void close() {
        if (s3 != null) s3.close();
        if (transcribe != null) transcribe.close();
    }

    public TranscribeResponse transcribe(MultipartFile file, String languageCode) {
        if (bucket == null || bucket.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "transcribe bucket not configured (aws.transcribe.bucket)");
        }
        String mediaFormat = detectFormat(file.getContentType(), file.getOriginalFilename());
        String jobName = "mn-" + UUID.randomUUID();
        String objectKey = prefix + jobName + "." + mediaFormat;

        // 1) Upload to S3
        try {
            s3.putObject(PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(objectKey)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to read upload: " + ex.getMessage());
        }
        String s3Uri = "s3://" + bucket + "/" + objectKey;
        log.debug("uploaded audio to {} for job {}", s3Uri, jobName);

        try {
            // 2) Start Transcribe job
            transcribe.startTranscriptionJob(StartTranscriptionJobRequest.builder()
                    .transcriptionJobName(jobName)
                    .languageCode(LanguageCode.fromValue(languageCode))
                    .mediaFormat(MediaFormat.fromValue(mediaFormat))
                    .media(Media.builder().mediaFileUri(s3Uri).build())
                    .settings(Settings.builder()
                            .showSpeakerLabels(false) // 화자 분리는 별도 옵션화 가능
                            .build())
                    .build());

            // 3) Poll
            TranscriptionJob done = pollJob(jobName);
            if (done.transcriptionJobStatus() == TranscriptionJobStatus.FAILED) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "transcribe job failed: " + done.failureReason());
            }

            // 4) Fetch result JSON from presigned URI returned by Transcribe
            String transcriptUri = done.transcript().transcriptFileUri();
            // 방어적 검증: AWS Transcribe가 반환하는 URI는 https + AWS 도메인이어야 함
            if (transcriptUri == null
                    || !transcriptUri.startsWith("https://")
                    || !(transcriptUri.contains(".amazonaws.com/") || transcriptUri.contains(".s3."))) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "unexpected transcript URI: " + transcriptUri);
            }
            String body = httpGet(transcriptUri);
            JsonNode root = json.readTree(body);
            String text = root.path("results").path("transcripts").path(0).path("transcript").asText("");
            long durationSec = -1L;
            // results may include "items" with timings; rough duration = last item's end_time
            JsonNode items = root.path("results").path("items");
            if (items.isArray() && items.size() > 0) {
                JsonNode last = items.get(items.size() - 1);
                String end = last.path("end_time").asText(null);
                if (end != null) {
                    try { durationSec = (long) Math.ceil(Double.parseDouble(end)); }
                    catch (NumberFormatException ignored) { /* keep -1 */ }
                }
            }
            return new TranscribeResponse(text, languageCode, durationSec, "aws-transcribe");
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception ex) {
            log.error("transcribe failed for job {}", jobName, ex);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "transcribe error: " + ex.getMessage());
        } finally {
            // 5) Best-effort cleanup of temp S3 upload + Transcribe job (avoid long-term accumulation)
            try {
                s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(objectKey).build());
            } catch (Exception ex) {
                log.warn("failed to delete temp S3 object {}: {}", objectKey, ex.getMessage());
            }
            try {
                transcribe.deleteTranscriptionJob(
                        DeleteTranscriptionJobRequest.builder().transcriptionJobName(jobName).build());
            } catch (Exception ex) {
                log.warn("failed to delete transcribe job {}: {}", jobName, ex.getMessage());
            }
        }
    }

    private TranscriptionJob pollJob(String jobName) throws InterruptedException {
        long deadline = System.currentTimeMillis() + POLL_TIMEOUT.toMillis();
        while (System.currentTimeMillis() < deadline) {
            TranscriptionJob job = transcribe.getTranscriptionJob(
                    GetTranscriptionJobRequest.builder().transcriptionJobName(jobName).build()
            ).transcriptionJob();
            TranscriptionJobStatus status = job.transcriptionJobStatus();
            if (status == TranscriptionJobStatus.COMPLETED || status == TranscriptionJobStatus.FAILED) {
                return job;
            }
            Thread.sleep(POLL_INTERVAL.toMillis());
        }
        throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,
                "transcribe job timed out after " + POLL_TIMEOUT.toSeconds() + "s");
    }

    private String httpGet(String url) throws IOException, InterruptedException {
        HttpResponse<String> resp = http.send(
                HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) {
            throw new IOException("transcript fetch HTTP " + resp.statusCode());
        }
        return resp.body();
    }

    /**
     * AWS Transcribe accepts: mp3, mp4, wav, flac, ogg, amr, webm, m4a.
     * The browser-recorded blob is typically {@code audio/webm;codecs=opus} → "webm".
     */
    private static String detectFormat(String contentType, String filename) {
        String ct = contentType == null ? "" : contentType.toLowerCase();
        if (ct.contains("webm")) return "webm";
        if (ct.contains("ogg"))  return "ogg";
        if (ct.contains("mp4") || ct.contains("m4a")) return "mp4";
        if (ct.contains("mpeg") || ct.contains("mp3")) return "mp3";
        if (ct.contains("wav") || ct.contains("wave")) return "wav";
        if (ct.contains("flac")) return "flac";
        // fallback by extension
        if (filename != null) {
            String f = filename.toLowerCase();
            if (f.endsWith(".webm")) return "webm";
            if (f.endsWith(".ogg")) return "ogg";
            if (f.endsWith(".mp4") || f.endsWith(".m4a")) return "mp4";
            if (f.endsWith(".mp3")) return "mp3";
            if (f.endsWith(".wav")) return "wav";
            if (f.endsWith(".flac")) return "flac";
        }
        return "webm"; // safest default for browser MediaRecorder
    }
}
