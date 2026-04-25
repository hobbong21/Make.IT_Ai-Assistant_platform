package com.humanad.makit.data;

import com.humanad.makit.audit.Auditable;
import com.humanad.makit.data.nlp.NlpAnalysisService;
import com.humanad.makit.data.nlp.dto.NlpAnalyzeRequest;
import com.humanad.makit.data.nlp.dto.NlpAnalyzeResponse;
import com.humanad.makit.data.url.UrlAnalysisService;
import com.humanad.makit.data.url.dto.UrlAnalyzeRequest;
import com.humanad.makit.data.url.dto.UrlAnalyzeResponse;
import com.humanad.makit.data.youtube.YoutubeCommentsService;
import com.humanad.makit.data.youtube.YoutubeInfluenceService;
import com.humanad.makit.data.youtube.YoutubeKeywordSearchService;
import com.humanad.makit.data.youtube.dto.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/data")
@RequiredArgsConstructor
@Tag(name = "data")
public class DataIntelligenceController {

    private final NlpAnalysisService nlpService;
    private final YoutubeCommentsService ytCommentsService;
    private final YoutubeInfluenceService ytInfluenceService;
    private final YoutubeKeywordSearchService ytKeywordSearchService;
    private final UrlAnalysisService urlAnalysisService;

    @PostMapping("/nlp/analyze")
    @Auditable(resource = "nlp-analyze")
    public NlpAnalyzeResponse nlpAnalyze(@Valid @RequestBody NlpAnalyzeRequest req) {
        return nlpService.analyze(req);
    }

    @PostMapping("/youtube/comments")
    @Auditable(resource = "youtube-comments")
    public YoutubeCommentsResponse youtubeComments(@Valid @RequestBody YoutubeCommentsRequest req) {
        return ytCommentsService.analyze(req);
    }

    @PostMapping("/youtube/influence")
    @Auditable(resource = "youtube-influence")
    public YoutubeInfluenceResponse youtubeInfluence(@Valid @RequestBody YoutubeInfluenceRequest req) {
        return ytInfluenceService.analyze(req);
    }

    @PostMapping("/url/analyze")
    @Auditable(resource = "url-analyze")
    public UrlAnalyzeResponse urlAnalyze(@Valid @RequestBody UrlAnalyzeRequest req) {
        return urlAnalysisService.analyze(req);
    }

    @PostMapping("/youtube/keyword-search")
    @Auditable(resource = "youtube-keyword-search")
    public YoutubeKeywordSearchResponse youtubeKeywordSearch(@Valid @RequestBody YoutubeKeywordSearchRequest req) {
        return ytKeywordSearchService.search(req);
    }
}
