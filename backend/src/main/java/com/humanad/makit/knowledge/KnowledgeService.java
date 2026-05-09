package com.humanad.makit.knowledge;

import com.humanad.makit.knowledge.dto.CollectionDto;
import com.humanad.makit.knowledge.dto.CollectionUpsertRequest;
import com.humanad.makit.knowledge.dto.DocumentDto;
import com.humanad.makit.knowledge.dto.DocumentUpsertRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * AX Office Hub workspace service. Handles collections, documents, favorites,
 * and trash with a simple permission model:
 *   - Read: any authenticated user (org-wide read).
 *   - Edit collection / manage members: owner OR system ADMIN OR member with role=ADMIN.
 *   - Create / edit / soft-delete documents: collection editors (above) OR member role=EDITOR
 *     OR document owner.
 *   - Purge trash: same as edit on the parent collection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeService {

    private final KnowledgeCollectionRepository collectionRepo;
    private final KnowledgeCollectionMemberRepository memberRepo;
    private final KnowledgeHubDocumentRepository docRepo;
    private final KnowledgeHubFavoriteRepository favoriteRepo;

    // ------------------------------------------------------------------
    // Collections
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<CollectionDto> listCollections() {
        UUID userId = CurrentUser.id();
        return collectionRepo.findAllByArchivedFalseOrderBySortOrderAscCreatedAtAsc()
                .stream()
                .map(c -> toCollectionDto(c, userId))
                .toList();
    }

    @Transactional
    public CollectionDto createCollection(CollectionUpsertRequest req) {
        UUID userId = CurrentUser.id();
        KnowledgeCollection c = new KnowledgeCollection();
        c.setOwnerId(userId);
        c.setName(req.name());
        c.setEmoji(req.emoji());
        c.setDescription(req.description());
        c.setSortOrder(req.sortOrder() == null ? 0 : req.sortOrder());
        c = collectionRepo.save(c);
        return toCollectionDto(c, userId);
    }

    @Transactional
    public CollectionDto updateCollection(UUID id, CollectionUpsertRequest req) {
        UUID userId = CurrentUser.id();
        KnowledgeCollection c = collectionRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("collection"));
        requireCollectionAdmin(c, userId);
        if (req.name() != null) c.setName(req.name());
        c.setEmoji(req.emoji());
        c.setDescription(req.description());
        if (req.sortOrder() != null) c.setSortOrder(req.sortOrder());
        return toCollectionDto(c, userId);
    }

    @Transactional
    public void deleteCollection(UUID id) {
        UUID userId = CurrentUser.id();
        KnowledgeCollection c = collectionRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("collection"));
        requireCollectionAdmin(c, userId);
        // Cascade-deletes documents/tags/favorites/members via FK ON DELETE CASCADE.
        collectionRepo.delete(c);
    }

    // ------------------------------------------------------------------
    // Documents
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DocumentDto> listDocuments(UUID collectionId) {
        UUID userId = CurrentUser.id();
        if (collectionId == null) throw KnowledgeException.badRequest("collectionId is required");
        // Implicit existence check
        collectionRepo.findById(collectionId).orElseThrow(() -> KnowledgeException.notFound("collection"));
        Set<UUID> favs = favoriteIdSet(userId);
        return docRepo.findAllByCollectionIdAndStatusNotOrderByUpdatedAtDesc(collectionId, DocStatus.TRASH)
                .stream()
                .map(d -> toDocumentDto(d, userId, favs))
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID id) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        return toDocumentDto(d, userId, favoriteIdSet(userId));
    }

    @Transactional
    public DocumentDto createDocument(DocumentUpsertRequest req) {
        UUID userId = CurrentUser.id();
        if (req.collectionId() == null) throw KnowledgeException.badRequest("collectionId is required");
        KnowledgeCollection c = collectionRepo.findById(req.collectionId())
                .orElseThrow(() -> KnowledgeException.notFound("collection"));
        requireCollectionEditor(c, userId);

        KnowledgeHubDocument d = new KnowledgeHubDocument();
        d.setCollectionId(c.getId());
        d.setOwnerId(userId);
        d.setTitle(req.title() == null || req.title().isBlank() ? "제목 없음" : req.title());
        d.setEmoji(req.emoji());
        d.setBodyMd(req.bodyMd() == null ? "" : req.bodyMd());
        d.setStatus(req.status() == null ? DocStatus.PUBLISHED : req.status());
        d.setTags(normalizeTags(req.tags()));
        d = docRepo.save(d);
        return toDocumentDto(d, userId, favoriteIdSet(userId));
    }

    @Transactional
    public DocumentDto updateDocument(UUID id, DocumentUpsertRequest req) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        requireDocumentEditor(d, userId);
        if (req.title() != null && !req.title().isBlank()) d.setTitle(req.title());
        if (req.emoji() != null) d.setEmoji(req.emoji());
        if (req.bodyMd() != null) d.setBodyMd(req.bodyMd());
        if (req.tags() != null) d.setTags(normalizeTags(req.tags()));
        if (req.status() != null) d.setStatus(req.status());
        return toDocumentDto(d, userId, favoriteIdSet(userId));
    }

    /** Soft-delete: status=TRASH, deleted_at=now. */
    @Transactional
    public void trashDocument(UUID id) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        requireDocumentEditor(d, userId);
        d.setStatus(DocStatus.TRASH);
        d.setDeletedAt(OffsetDateTime.now());
    }

    // ------------------------------------------------------------------
    // Favorites
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DocumentDto> listFavorites() {
        UUID userId = CurrentUser.id();
        Set<UUID> favs = favoriteIdSet(userId);
        if (favs.isEmpty()) return List.of();
        Set<UUID> all = new HashSet<>(favs);
        return docRepo.findAllById(all).stream()
                .filter(d -> d.getStatus() != DocStatus.TRASH)
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .map(d -> toDocumentDto(d, userId, favs))
                .toList();
    }

    @Transactional
    public void addFavorite(UUID docId) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(docId)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        if (favoriteRepo.existsByUserIdAndDocumentId(userId, d.getId())) return;
        KnowledgeHubFavorite f = new KnowledgeHubFavorite();
        f.setUserId(userId);
        f.setDocumentId(d.getId());
        favoriteRepo.save(f);
    }

    @Transactional
    public void removeFavorite(UUID docId) {
        favoriteRepo.deleteByUserIdAndDocumentId(CurrentUser.id(), docId);
    }

    // ------------------------------------------------------------------
    // Trash
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DocumentDto> listTrash() {
        UUID userId = CurrentUser.id();
        Set<UUID> favs = favoriteIdSet(userId);
        return docRepo.findAllByStatusOrderByUpdatedAtDesc(DocStatus.TRASH).stream()
                .map(d -> toDocumentDto(d, userId, favs))
                .toList();
    }

    @Transactional
    public DocumentDto restoreFromTrash(UUID id) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        requireDocumentEditor(d, userId);
        d.setStatus(DocStatus.PUBLISHED);
        d.setDeletedAt(null);
        return toDocumentDto(d, userId, favoriteIdSet(userId));
    }

    @Transactional
    public void purgeFromTrash(UUID id) {
        UUID userId = CurrentUser.id();
        KnowledgeHubDocument d = docRepo.findById(id)
                .orElseThrow(() -> KnowledgeException.notFound("document"));
        requireDocumentEditor(d, userId);
        if (d.getStatus() != DocStatus.TRASH) {
            throw KnowledgeException.badRequest("document is not in trash");
        }
        docRepo.delete(d);
    }

    // ------------------------------------------------------------------
    // Search (used by both global search view and Cmd+K palette)
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<DocumentDto> search(String q) {
        UUID userId = CurrentUser.id();
        if (q == null || q.isBlank()) return List.of();
        Set<UUID> favs = favoriteIdSet(userId);
        return docRepo.searchActive(q.trim()).stream()
                .map(d -> toDocumentDto(d, userId, favs))
                .toList();
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private CollectionDto toCollectionDto(KnowledgeCollection c, UUID userId) {
        long count = docRepo.countByCollectionIdAndStatusNot(c.getId(), DocStatus.TRASH);
        return new CollectionDto(
                c.getId(), c.getOwnerId(), c.getName(), c.getEmoji(), c.getDescription(),
                c.getSortOrder(), c.isArchived(), count, canEditCollection(c, userId),
                c.getCreatedAt(), c.getUpdatedAt()
        );
    }

    private DocumentDto toDocumentDto(KnowledgeHubDocument d, UUID userId, Set<UUID> favs) {
        boolean canEdit = canEditDocumentByOwnership(d, userId)
                || canEditCollectionId(d.getCollectionId(), userId);
        List<String> tags = new ArrayList<>(d.getTags());
        tags.sort(String::compareTo);
        return new DocumentDto(
                d.getId(), d.getCollectionId(), d.getOwnerId(), d.getTitle(), d.getEmoji(),
                d.getBodyMd(), d.getStatus(), tags, favs.contains(d.getId()), canEdit,
                d.getCreatedAt(), d.getUpdatedAt(), d.getDeletedAt()
        );
    }

    private Set<UUID> favoriteIdSet(UUID userId) {
        Set<UUID> ids = new HashSet<>();
        for (KnowledgeHubFavorite f : favoriteRepo.findAllByUserId(userId)) ids.add(f.getDocumentId());
        return ids;
    }

    private Set<String> normalizeTags(List<String> tags) {
        Set<String> out = new HashSet<>();
        if (tags == null) return out;
        for (String t : tags) {
            if (t == null) continue;
            String tt = t.trim();
            if (tt.isEmpty()) continue;
            if (tt.length() > 64) tt = tt.substring(0, 64);
            out.add(tt);
        }
        return out;
    }

    // --- permission predicates ---

    private boolean canEditCollection(KnowledgeCollection c, UUID userId) {
        if (CurrentUser.isSystemAdmin()) return true;
        if (c.getOwnerId().equals(userId)) return true;
        Optional<KnowledgeCollectionMember> m =
                memberRepo.findByCollectionIdAndUserId(c.getId(), userId);
        return m.isPresent() && m.get().getRole() == CollectionRole.ADMIN;
    }

    private boolean canEditCollectionId(UUID collectionId, UUID userId) {
        if (CurrentUser.isSystemAdmin()) return true;
        return collectionRepo.findById(collectionId)
                .map(c -> {
                    if (c.getOwnerId().equals(userId)) return true;
                    Optional<KnowledgeCollectionMember> m =
                            memberRepo.findByCollectionIdAndUserId(c.getId(), userId);
                    return m.isPresent()
                            && (m.get().getRole() == CollectionRole.ADMIN
                                || m.get().getRole() == CollectionRole.EDITOR);
                })
                .orElse(false);
    }

    private boolean canEditDocumentByOwnership(KnowledgeHubDocument d, UUID userId) {
        return CurrentUser.isSystemAdmin() || d.getOwnerId().equals(userId);
    }

    private void requireCollectionAdmin(KnowledgeCollection c, UUID userId) {
        if (!canEditCollection(c, userId)) {
            throw KnowledgeException.forbidden("not allowed to manage this collection");
        }
    }

    private void requireCollectionEditor(KnowledgeCollection c, UUID userId) {
        if (canEditCollection(c, userId)) return;
        Optional<KnowledgeCollectionMember> m =
                memberRepo.findByCollectionIdAndUserId(c.getId(), userId);
        if (m.isPresent() && m.get().getRole() == CollectionRole.EDITOR) return;
        throw KnowledgeException.forbidden("not allowed to edit documents in this collection");
    }

    private void requireDocumentEditor(KnowledgeHubDocument d, UUID userId) {
        if (canEditDocumentByOwnership(d, userId)) return;
        if (canEditCollectionId(d.getCollectionId(), userId)) return;
        throw KnowledgeException.forbidden("not allowed to edit this document");
    }
}
