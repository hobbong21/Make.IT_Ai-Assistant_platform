package com.humanad.makit.commerce.chatbot.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatMessageRequest(
        @NotBlank @Size(max = 8000) String message,
        String contextId,
        Boolean useRag,
        @DecimalMin("0.0") @DecimalMax("1.0") Double temperature
) {}
