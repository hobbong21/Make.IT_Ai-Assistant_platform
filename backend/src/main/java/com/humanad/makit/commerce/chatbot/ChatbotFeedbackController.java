package com.humanad.makit.commerce.chatbot;

import com.humanad.makit.commerce.chatbot.dto.ChatbotFeedbackRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Controller for chatbot feedback endpoints.
 * Allows users to provide feedback (helpful/unhelpful) on chatbot responses.
 */
@Slf4j
@RestController
@RequestMapping("/api/commerce/chatbot")
@RequiredArgsConstructor
@Tag(name = "commerce")
public class ChatbotFeedbackController {

    private final ChatbotFeedbackRepository feedbackRepository;

    /**
     * POST /api/commerce/chatbot/feedback
     *
     * Submit feedback on a chatbot response.
     * Extracts userId from authentication context.
     *
     * @param request the feedback request (contextId, messageIdx, helpful, comment)
     * @return 201 Created with empty body
     */
    @PostMapping("/feedback")
    @Operation(summary = "Submit feedback on chatbot response")
    public ResponseEntity<Void> submitFeedback(@Valid @RequestBody ChatbotFeedbackRequest request) {
        UUID userId = currentUserId();

        ChatbotFeedback feedback = new ChatbotFeedback();
        feedback.setUserId(userId);
        feedback.setContextId(request.contextId());
        feedback.setMessageIdx(request.messageIdx());
        feedback.setHelpful(request.helpful());
        feedback.setComment(request.comment());

        try {
            feedbackRepository.save(feedback);
            log.debug("Chatbot feedback saved: userId={}, contextId={}, helpful={}", userId, request.contextId(), request.helpful());
            return ResponseEntity.status(HttpStatus.CREATED).build();
        } catch (Exception ex) {
            log.error("Failed to save chatbot feedback: {}", ex.getMessage(), ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Extract the authenticated user's ID from Spring Security context.
     */
    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            return auth != null && auth.getName() != null ? UUID.fromString(auth.getName()) : UUID.randomUUID();
        } catch (Exception ex) {
            log.warn("Failed to extract user ID from authentication", ex);
            return UUID.randomUUID();
        }
    }
}
