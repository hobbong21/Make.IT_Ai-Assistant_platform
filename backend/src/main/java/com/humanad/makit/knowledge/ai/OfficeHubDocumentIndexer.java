package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.dto.KnowledgeDocumentRef;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * Async hook that turns a document save into a Titan-embedded, pgvector-stored
 * set of chunks. Decoupled via {@link KnowledgeDocumentSavedEvent} so the
 * synchronous CRUD path returns immediately even when Bedrock is slow.
 *
 * <p><b>Phase ordering:</b> bound to {@link TransactionPhase#AFTER_COMMIT} so
 * the parent {@code knowledge_documents} row is durable before we insert
 * {@code knowledge_chunks} rows that hold an FK to it. Without this, the async
 * listener could race the commit and the FK insert would fail silently.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OfficeHubDocumentIndexer {

    private final KnowledgeRetriever retriever;

    @Async("aiExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSaved(KnowledgeDocumentSavedEvent ev) {
        if (ev.content() == null || ev.content().isBlank()) {
            log.debug("Skip indexing doc={} — empty content", ev.documentId());
            return;
        }
        try {
            retriever.indexDocument(
                    new KnowledgeDocumentRef(
                            ev.documentId(),
                            ev.title(),
                            ev.sourceType() == null ? "office_hub" : ev.sourceType(),
                            ev.companyId()),
                    ev.content(),
                    Map.of());
            log.info("Indexed Office Hub doc={} title=\"{}\"", ev.documentId(), ev.title());
        } catch (Exception e) {
            log.error("Failed to index Office Hub doc={}: {}", ev.documentId(), e.toString());
        }
    }
}
