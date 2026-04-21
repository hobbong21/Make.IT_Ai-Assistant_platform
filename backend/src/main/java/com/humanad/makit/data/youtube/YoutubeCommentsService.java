package com.humanad.makit.data.youtube;

import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.data.youtube.dto.YoutubeCommentsRequest;
import com.humanad.makit.data.youtube.dto.YoutubeCommentsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * TODO(ai-engineer): wire real YouTube Data API ingestion + Bedrock theme clustering
 * using prompt key "data/youtube/comment_cluster.md".
 * Sync path returns an immediate empty analysis. Long-running mode uses JobService (data domain).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YoutubeCommentsService {

    private final ContentStrategySelector strategySelector;

    public YoutubeCommentsResponse analyze(YoutubeCommentsRequest request) {
        String videoId = extractVideoId(request.videoUrl());
        return new YoutubeCommentsResponse(
                videoId, 0,
                Map.of("positive", 0.0, "neutral", 0.0, "negative", 0.0),
                List.of(), null
        );
    }

    private String extractVideoId(String url) {
        if (url == null) return "";
        int idx = url.indexOf("v=");
        if (idx >= 0) {
            int end = url.indexOf('&', idx);
            return end < 0 ? url.substring(idx + 2) : url.substring(idx + 2, end);
        }
        int slash = url.lastIndexOf('/');
        return slash < 0 ? url : url.substring(slash + 1);
    }
}
