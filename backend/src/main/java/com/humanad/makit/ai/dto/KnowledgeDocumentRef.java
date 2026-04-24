package com.humanad.makit.ai.dto;

/**
 * Light reference to a KnowledgeDocument (owned by the commerce module).
 * The AI layer takes this ref + raw text + metadata; it does NOT touch the entity.
 */
public record KnowledgeDocumentRef(
        String documentId,
        String title,
        String sourceType,
        String companyId
) {}
