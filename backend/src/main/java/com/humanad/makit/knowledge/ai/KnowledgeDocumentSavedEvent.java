package com.humanad.makit.knowledge.ai;

/**
 * Published by {@code KnowledgeDocumentService.save()} so the AI layer can
 * (re)index the document asynchronously without coupling the CRUD path to
 * Bedrock latency. Listener: {@link OfficeHubDocumentIndexer}.
 */
public record KnowledgeDocumentSavedEvent(
        String documentId,
        String title,
        String content,
        String sourceType,
        String companyId
) {}
