package com.humanad.makit.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CollectionUpsertRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 16) String emoji,
        @Size(max = 500) String description,
        Integer sortOrder
) {}
