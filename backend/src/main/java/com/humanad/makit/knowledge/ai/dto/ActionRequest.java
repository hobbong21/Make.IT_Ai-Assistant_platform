package com.humanad.makit.knowledge.ai.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Document-scoped action (요약 / 연관 / 태그 / 초안). The body is supplied so
 * the action runs even before the document is fully indexed (UX: no waiting
 * for the embedding pipeline on first save).
 *
 * @param documentId   the doc the action targets — used as a retrieval filter
 *                     and for "related" exclusion.
 * @param title        document title (for action prompts that quote it).
 * @param body         raw markdown text the user is currently viewing.
 * @param tags         existing tags (used by the "tags" action as seed).
 * @param collectionId optional — limits "related" search to same collection.
 */
public record ActionRequest(
        @NotBlank String documentId,
        String title,
        String body,
        java.util.List<String> tags,
        String collectionId
) {}
