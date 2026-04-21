package com.humanad.makit.commerce.knowledge;

import com.humanad.makit.common.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Metadata-only CRUD for knowledge documents. Chunk/embed/search lives in ai-engineer's
 * KnowledgeRetriever implementation.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class KnowledgeDocumentService {

    private final KnowledgeDocumentRepository repo;

    public KnowledgeDocument save(KnowledgeDocument doc) {
        return repo.save(doc);
    }

    @Transactional(readOnly = true)
    public KnowledgeDocument get(String documentId) {
        return repo.findById(documentId).orElseThrow(() -> new ResourceNotFoundException("KnowledgeDocument", documentId));
    }

    public void delete(String documentId) {
        repo.deleteById(documentId);
    }
}
