package com.humanad.makit.commerce;

import com.humanad.makit.commerce.chatbot.ChatbotService;
import com.humanad.makit.commerce.chatbot.dto.ChatMessageRequest;
import com.humanad.makit.commerce.chatbot.dto.ChatMessageResponse;
import com.humanad.makit.commerce.modelshot.ModelshotService;
import com.humanad.makit.commerce.modelshot.dto.ModelshotRequest;
import com.humanad.makit.commerce.review.ReviewAnalysisService;
import com.humanad.makit.commerce.review.dto.ReviewAnalysisRequest;
import com.humanad.makit.commerce.review.dto.ReviewAnalysisResponse;
import com.humanad.makit.job.JobAcceptedResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/commerce")
@RequiredArgsConstructor
@Tag(name = "commerce")
public class CommerceBrainController {

    private final ChatbotService chatbotService;
    private final ReviewAnalysisService reviewAnalysisService;
    private final ModelshotService modelshotService;

    @PostMapping("/chatbot/message")
    public ChatMessageResponse message(@Valid @RequestBody ChatMessageRequest req) {
        UUID userId = currentUserId();
        return chatbotService.chat(req, userId, "web");
    }

    @PostMapping("/reviews/{productId}/analyze")
    public ReviewAnalysisResponse reviewAnalyze(@PathVariable String productId,
                                                @RequestBody(required = false) ReviewAnalysisRequest req) {
        return reviewAnalysisService.analyze(productId, req);
    }

    @PostMapping("/modelshot/generate")
    public ResponseEntity<JobAcceptedResponse> modelshot(@Valid @RequestBody ModelshotRequest req) {
        UUID userId = currentUserId();
        JobAcceptedResponse accepted = modelshotService.generate(req, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(accepted);
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            return UUID.fromString(auth.getName());
        } catch (Exception ex) {
            return UUID.randomUUID();
        }
    }
}
