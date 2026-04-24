package com.humanad.makit.data.youtube;

import com.humanad.makit.data.youtube.dto.YoutubeInfluenceRequest;
import com.humanad.makit.data.youtube.dto.YoutubeInfluenceResponse;
import org.springframework.stereotype.Service;

/**
 * TODO(ai-engineer): real channel stats fetch + influence scoring model.
 */
@Service
public class YoutubeInfluenceService {

    public YoutubeInfluenceResponse analyze(YoutubeInfluenceRequest req) {
        return new YoutubeInfluenceResponse(
                req.channelId(),
                0f,
                "NANO",
                new YoutubeInfluenceResponse.Metrics(0, 0, 0, 0)
        );
    }
}
