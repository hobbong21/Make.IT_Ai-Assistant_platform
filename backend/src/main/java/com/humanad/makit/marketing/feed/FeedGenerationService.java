package com.humanad.makit.marketing.feed;

import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedContent;
import com.humanad.makit.ai.dto.TextGenerationRequest;
import com.humanad.makit.common.ExternalServiceException;
import com.humanad.makit.job.JobAcceptedResponse;
import com.humanad.makit.job.JobExecution;
import com.humanad.makit.job.JobService;
import com.humanad.makit.marketing.feed.dto.InstagramFeedRequest;
import com.humanad.makit.marketing.feed.dto.InstagramFeedResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;

@Slf4j
@Service
@RequiredArgsConstructor
public class FeedGenerationService {

    private final ContentStrategySelector strategySelector;
    private final JobService jobService;
    @Qualifier("aiExecutor")
    private final Executor aiExecutor;

    public ResponseEntity<?> generate(InstagramFeedRequest req, UUID userId) {
        boolean includeImage = Boolean.TRUE.equals(req.includeImage());
        if (includeImage) {
            JobExecution job = jobService.create(userId, "marketing", "feed.generate", Map.of(
                    "brief", req.brief(),
                    "includeImage", true
            ));
            aiExecutor.execute(() -> runAsync(job.getJobId(), req));
            JobAcceptedResponse accepted = jobService.toAccepted(job);
            return ResponseEntity.accepted().body(accepted);
        }
        InstagramFeedResponse body = generateSyncText(req);
        return ResponseEntity.ok(body);
    }

    private InstagramFeedResponse generateSyncText(InstagramFeedRequest req) {
        TextGenerationRequest gen = new TextGenerationRequest(
                ContentType.INSTAGRAM_CAPTION,
                "marketing/instagram_caption.md",
                Map.of(
                        "brief", req.brief(),
                        "brandTone", req.brandTone() == null ? "FRIENDLY" : req.brandTone().name(),
                        "locale", req.locale() == null ? "ko-KR" : req.locale(),
                        "hashtagCount", req.hashtagCount() == null ? 10 : req.hashtagCount(),
                        "targetAudience", req.targetAudience() == null ? "" : req.targetAudience()
                ),
                null, 1024, 0.6, UUID.randomUUID(), TextGenerationRequest.Quality.STANDARD
        );
        try {
            ContentGenerationStrategy contentGen = strategySelector.select(ContentType.INSTAGRAM_CAPTION);
            GeneratedContent gc = contentGen.generateText(gen).join();
            return new InstagramFeedResponse(
                    gc.text() == null ? "" : gc.text(),
                    List.of(),
                    null,
                    null
            );
        } catch (CompletionException ce) {
            throw new ExternalServiceException("AI_BEDROCK_ERROR", "Feed generation failed", ce.getCause());
        }
    }

    private void runAsync(UUID jobId, InstagramFeedRequest req) {
        try {
            jobService.markRunning(jobId);
            InstagramFeedResponse result = generateSyncText(req);
            // TODO(ai-engineer): also call generateImage() via strategySelector.select(ContentType.IMAGE)
            // with prompt key "marketing/image_prompt.md" and attach imageUrl.
            jobService.markSuccess(jobId, Map.of(
                    "caption", result.caption(),
                    "hashtags", result.hashtags(),
                    "imageUrl", result.imageUrl() == null ? "" : result.imageUrl()
            ));
        } catch (Exception ex) {
            log.error("Feed async job {} failed", jobId, ex);
            jobService.markFailed(jobId, ex.getMessage());
        }
    }
}
