package com.humanad.makit.data.nlp;

import com.humanad.makit.ai.ContentGenerationStrategy;
import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.ai.dto.ContentType;
import com.humanad.makit.ai.dto.GeneratedContent;
import com.humanad.makit.ai.dto.TextGenerationRequest;
import com.humanad.makit.common.ExternalServiceException;
import com.humanad.makit.data.nlp.dto.NlpAnalyzeRequest;
import com.humanad.makit.data.nlp.dto.NlpAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletionException;

@Slf4j
@Service
@RequiredArgsConstructor
public class NlpAnalysisService {

    private final ContentStrategySelector strategySelector;

    public NlpAnalyzeResponse analyze(NlpAnalyzeRequest request) {
        TextGenerationRequest gen = new TextGenerationRequest(
                ContentType.BLOG_POST, // generic analysis prompt
                "data/nlp/sentiment.md",
                Map.of(
                        "text", request.text(),
                        "tasks", request.tasks() == null ? List.of("SENTIMENT", "KEYWORDS", "SUMMARY") : request.tasks(),
                        "language", request.language() == null ? "ko" : request.language()
                ),
                null, 1024, 0.2, UUID.randomUUID(), TextGenerationRequest.Quality.STANDARD
        );
        try {
            ContentGenerationStrategy contentGen = strategySelector.select(ContentType.BLOG_POST);
            GeneratedContent gc = contentGen.generateText(gen).join();
            // The ai-engineer prompt must emit JSON. For the stub we return a simple reply.
            return new NlpAnalyzeResponse(
                    new NlpAnalyzeResponse.Sentiment("NEUTRAL", 0.5f),
                    List.of(),
                    List.of(),
                    gc.text() == null ? "" : gc.text(),
                    null,
                    gc.modelId()
            );
        } catch (CompletionException ce) {
            throw new ExternalServiceException("AI_BEDROCK_ERROR", "NLP analysis failed", ce.getCause());
        }
    }
}
