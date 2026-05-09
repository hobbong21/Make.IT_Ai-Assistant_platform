package com.humanad.makit.knowledge.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollectionUpsertRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 16) String emoji,
        @Size(max = 500) String description,
        Integer sortOrder,
        /**
         * Optional per-collection AI confidence threshold (0.0–1.0). When null the
         * collection inherits the user/global threshold. See task #36.
         */
        @DecimalMin("0.0") @DecimalMax("1.0") Double confidenceThreshold
) {}
