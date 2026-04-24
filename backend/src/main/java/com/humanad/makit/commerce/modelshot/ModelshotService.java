package com.humanad.makit.commerce.modelshot;

import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.ImageEditRequest;
import com.humanad.makit.commerce.modelshot.dto.ModelshotRequest;
import com.humanad.makit.job.JobAcceptedResponse;
import com.humanad.makit.job.JobExecution;
import com.humanad.makit.job.JobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;

@Slf4j
@Service
@RequiredArgsConstructor
public class ModelshotService {

    private final ContentStrategySelector strategySelector;
    private final JobService jobService;
    @Qualifier("aiExecutor")
    private final Executor aiExecutor;

    public JobAcceptedResponse generate(ModelshotRequest req, UUID userId) {
        JobExecution job = jobService.create(userId, "commerce", "modelshot.generate", Map.of(
                "productImageUrl", req.productImageUrl(),
                "background", String.valueOf(req.background()),
                "resolution", req.resolution() == null ? "1024x1024" : req.resolution().label()
        ));
        aiExecutor.execute(() -> runAsync(job.getJobId(), req));
        return jobService.toAccepted(job);
    }

    private void runAsync(UUID jobId, ModelshotRequest req) {
        try {
            jobService.markRunning(jobId);
            // Prompt key for modelshot: commerce/modelshot_prompt.md (used by ai-engineer's strategy).
            ImageEditRequest edit = new ImageEditRequest(
                    ImageEditRequest.Operation.COMPOSITE,
                    req.productImageUrl(),
                    null,
                    req.customPrompt(),
                    1024, 1024,
                    UUID.randomUUID(),
                    Map.of("promptKey", "commerce/modelshot_prompt.md")
            );
            ContentGenerationStrategy contentGen = strategySelector.select(ContentType.IMAGE_EDIT);
            var result = contentGen.editImage(edit).join();
            jobService.markSuccess(jobId, Map.of(
                    "imageUrl", result.imageUrl() == null ? "" : result.imageUrl(),
                    "mimeType", result.mimeType() == null ? "image/png" : result.mimeType()
            ));
        } catch (Exception ex) {
            log.error("Modelshot job {} failed", jobId, ex);
            jobService.markFailed(jobId, ex.getMessage());
        }
    }
}
