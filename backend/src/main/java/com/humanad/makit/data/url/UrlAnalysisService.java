package com.humanad.makit.data.url;

import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.data.url.dto.UrlAnalyzeRequest;
import com.humanad.makit.data.url.dto.UrlAnalyzeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * TODO(ai-engineer): implement URL fetch + reader-mode extraction and summarization
 * via ContentStrategySelector with prompt key "data/url/seo_summary.md".
 */
@Service
@RequiredArgsConstructor
public class UrlAnalysisService {

    private final ContentStrategySelector strategySelector;

    public UrlAnalyzeResponse analyze(UrlAnalyzeRequest req) {
        return new UrlAnalyzeResponse(
                req.url(),
                "",
                "",
                List.of(),
                0,
                null
        );
    }
}
