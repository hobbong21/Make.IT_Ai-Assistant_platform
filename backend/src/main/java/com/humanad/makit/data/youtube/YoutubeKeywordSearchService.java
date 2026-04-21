package com.humanad.makit.data.youtube;

import com.humanad.makit.data.youtube.dto.YoutubeKeywordSearchRequest;
import com.humanad.makit.data.youtube.dto.YoutubeKeywordSearchResponse;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * TODO(ai-engineer): real YouTube search + relevance scoring.
 */
@Service
public class YoutubeKeywordSearchService {

    public YoutubeKeywordSearchResponse search(YoutubeKeywordSearchRequest req) {
        return new YoutubeKeywordSearchResponse(req.keywords(), List.of());
    }
}
