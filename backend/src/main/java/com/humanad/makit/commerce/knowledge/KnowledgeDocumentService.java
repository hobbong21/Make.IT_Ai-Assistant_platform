package com.humanad.makit.commerce.knowledge;

import com.humanad.makit.common.ResourceNotFoundException;
import com.humanad.makit.knowledge.ai.KnowledgeDocumentSavedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Metadata-only CRUD for knowledge documents. Chunk/embed/search lives in ai-engineer's
 * KnowledgeRetriever implementation. Save publishes a {@link KnowledgeDocumentSavedEvent}
 * so the Office Hub indexer can re-embed asynchronously (Phase 3).
 */
@Service
@Transactional
@RequiredArgsConstructor
public class KnowledgeDocumentService {

    private final KnowledgeDocumentRepository repo;
    private final ApplicationEventPublisher events;

    public KnowledgeDocument save(KnowledgeDocument doc) {
        KnowledgeDocument saved = repo.save(doc);
        events.publishEvent(new KnowledgeDocumentSavedEvent(
                saved.getDocumentId(),
                saved.getTitle(),
                saved.getContent(),
                saved.getDocumentType(),
                null));
        return saved;
    }

    @Transactional(readOnly = true)
    public KnowledgeDocument get(String documentId) {
        return repo.findById(documentId).orElseThrow(() -> new ResourceNotFoundException("KnowledgeDocument", documentId));
    }

    public void delete(String documentId) {
        repo.deleteById(documentId);
    }
}
