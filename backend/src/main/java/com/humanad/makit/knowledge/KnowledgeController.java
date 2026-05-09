package com.humanad.makit.knowledge;

import com.humanad.makit.knowledge.dto.CollectionDto;
import com.humanad.makit.knowledge.dto.CollectionUpsertRequest;
import com.humanad.makit.knowledge.dto.DocumentDto;
import com.humanad.makit.knowledge.dto.DocumentUpsertRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * AX Office Hub REST surface — collections, documents, favorites, trash.
 * Mounted under /api/knowledge/*. All endpoints require authentication
 * (enforced globally in {@link com.humanad.makit.config.SecurityConfig}).
 */
@RestController
@RequestMapping("/api/knowledge")
@RequiredArgsConstructor
@Tag(name = "office-hub")
public class KnowledgeController {

    private final KnowledgeService service;

    // -------------------- Collections --------------------

    @GetMapping("/collections")
    public List<CollectionDto> listCollections() {
        return service.listCollections();
    }

    @PostMapping("/collections")
    public CollectionDto createCollection(@Valid @RequestBody CollectionUpsertRequest req) {
        return service.createCollection(req);
    }

    @PatchMapping("/collections/{id}")
    public CollectionDto updateCollection(@PathVariable UUID id,
                                          @Valid @RequestBody CollectionUpsertRequest req) {
        return service.updateCollection(id, req);
    }

    @DeleteMapping("/collections/{id}")
    public ResponseEntity<Void> deleteCollection(@PathVariable UUID id) {
        service.deleteCollection(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------- Documents --------------------

    @GetMapping("/documents")
    public List<DocumentDto> listDocuments(@RequestParam(value = "collection", required = false) UUID collectionId,
                                           @RequestParam(value = "q", required = false) String q) {
        if (q != null && !q.isBlank()) return service.search(q);
        return service.listDocuments(collectionId);
    }

    @GetMapping("/documents/{id}")
    public DocumentDto getDocument(@PathVariable UUID id) {
        return service.getDocument(id);
    }

    @PostMapping("/documents")
    public DocumentDto createDocument(@Valid @RequestBody DocumentUpsertRequest req) {
        return service.createDocument(req);
    }

    @PatchMapping("/documents/{id}")
    public DocumentDto updateDocument(@PathVariable UUID id,
                                      @Valid @RequestBody DocumentUpsertRequest req) {
        return service.updateDocument(id, req);
    }

    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> trashDocument(@PathVariable UUID id) {
        service.trashDocument(id);
        return ResponseEntity.noContent().build();
    }

    // -------------------- Favorites --------------------

    @GetMapping("/favorites")
    public List<DocumentDto> listFavorites() {
        return service.listFavorites();
    }

    @PostMapping("/favorites/{docId}")
    public ResponseEntity<Void> addFavorite(@PathVariable UUID docId) {
        service.addFavorite(docId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/favorites/{docId}")
    public ResponseEntity<Void> removeFavorite(@PathVariable UUID docId) {
        service.removeFavorite(docId);
        return ResponseEntity.noContent().build();
    }

    // -------------------- Trash --------------------

    @GetMapping("/trash")
    public List<DocumentDto> listTrash() {
        return service.listTrash();
    }

    @PostMapping("/trash/{id}/restore")
    public DocumentDto restoreFromTrash(@PathVariable UUID id) {
        return service.restoreFromTrash(id);
    }

    @DeleteMapping("/trash/{id}")
    public ResponseEntity<Void> purgeFromTrash(@PathVariable UUID id) {
        service.purgeFromTrash(id);
        return ResponseEntity.noContent().build();
    }
}
