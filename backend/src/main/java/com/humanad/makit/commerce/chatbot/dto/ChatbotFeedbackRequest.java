package com.humanad.makit.commerce.chatbot.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Request DTO for submitting chatbot response feedback (thumbs up/down).
 */
public record ChatbotFeedbackRequest(
        String contextId,
        Integer messageIdx,
        @NotNull(message = "helpful field is required")
        Boolean helpful,
        String comment
) {}
