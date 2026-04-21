package com.humanad.makit.commerce.review;

import com.humanad.makit.ai.ContentStrategySelector;
import com.humanad.makit.commerce.review.dto.ReviewAnalysisRequest;
import com.humanad.makit.commerce.review.dto.ReviewAnalysisResponse;
import com.humanad.makit.common.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

/**
 * TODO(ai-engineer): use ContentStrategySelector to summarize reviews into themes and improvement points
 * with prompt key "commerce/review_sentiment.md".
 * v1 returns an aggregation-only stub that counts reviews and derives a naive sentiment.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewAnalysisService {

    private final ReviewRepository reviewRepository;
    private final ContentStrategySelector strategySelector;

    @Transactional(readOnly = true)
    public ReviewAnalysisResponse analyze(String productId, ReviewAnalysisRequest req) {
        List<Review> reviews;
        if (req != null && req.since() != null) {
            OffsetDateTime since = req.since().atStartOfDay().atOffset(ZoneOffset.UTC);
            reviews = reviewRepository.findByProductIdAndCreatedAtAfter(productId, since);
        } else {
            reviews = reviewRepository.findByProductIdOrderByCreatedAtDesc(productId);
        }
        if (reviews.isEmpty()) {
            throw new ResourceNotFoundException("Reviews for product", productId);
        }
        double avg = reviews.stream().mapToInt(r -> r.getRating() == null ? 0 : r.getRating()).average().orElse(0);
        String label = avg >= 4 ? "POSITIVE" : avg <= 2 ? "NEGATIVE" : "NEUTRAL";
        return new ReviewAnalysisResponse(
                productId,
                reviews.size(),
                new ReviewAnalysisResponse.OverallSentiment(avg / 5.0, label),
                List.of(),
                List.of()
        );
    }
}
