package com.humanad.makit.officehub;

import com.humanad.makit.common.ResourceNotFoundException;
import com.humanad.makit.common.security.DocumentSanitizer;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Office Hub document write service. Sanitizes every payload via
 * {@link DocumentSanitizer} before persisting, so stored data is always safe
 * regardless of which controller path called in.
 *
 * <p>Phase 2 will swap the in-memory store for a JPA repository. The
 * sanitization invocation is the contract this service guarantees.
 */
@Service
public class OfficeHubDocumentService {

    private final DocumentSanitizer sanitizer;
    private final ConcurrentMap<String, OfficeHubDocument> store = new ConcurrentHashMap<>();

    public OfficeHubDocumentService(DocumentSanitizer sanitizer) {
        this.sanitizer = sanitizer;
    }

    public OfficeHubDocument create(DocumentWriteRequest request) {
        DocumentWriteRequest safe = sanitizer.sanitize(request);
        String id = UUID.randomUUID().toString();
        OfficeHubDocument doc = new OfficeHubDocument(
                id, safe.title(), safe.tags(), safe.bodyMarkdown(), Instant.now());
        store.put(id, doc);
        return doc;
    }

    public OfficeHubDocument update(String id, DocumentWriteRequest request) {
        if (!store.containsKey(id)) {
            throw new ResourceNotFoundException("OfficeHubDocument", id);
        }
        DocumentWriteRequest safe = sanitizer.sanitize(request);
        OfficeHubDocument doc = new OfficeHubDocument(
                id, safe.title(), safe.tags(), safe.bodyMarkdown(), Instant.now());
        store.put(id, doc);
        return doc;
    }

    public Optional<OfficeHubDocument> find(String id) {
        return Optional.ofNullable(store.get(id));
    }
}
