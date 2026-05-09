package com.humanad.makit.knowledge.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Captures 👍/👎 plus optional free-form note for an AI reply.
 * Persisted so we can monitor citation accuracy / response quality
 * over time per the Phase 3 acceptance criteria.
 *
 * @param contextId   the AI conversation/answer this feedback belongs to.
 * @param documentId  optional — set when the answer was a document action.
 * @param action      "ask" | "summarize" | "related" | "tags" | "draft".
 * @param helpful     true=👍 false=👎.
 * @param comment     optional reviewer note (≤1k chars).
 */
public record FeedbackRequest(
        @NotBlank String contextId,
        String documentId,
        @NotBlank String action,
        boolean helpful,
        @Size(max = 1000) String comment
) {}
