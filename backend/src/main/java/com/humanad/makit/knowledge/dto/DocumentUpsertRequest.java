package com.humanad.makit.knowledge.dto;

import com.humanad.makit.knowledge.DocStatus;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record DocumentUpsertRequest(
        UUID collectionId,
        @Size(max = 255) String title,
        @Size(max = 16) String emoji,
        String bodyMd,
        List<String> tags,
        DocStatus status
) {}
