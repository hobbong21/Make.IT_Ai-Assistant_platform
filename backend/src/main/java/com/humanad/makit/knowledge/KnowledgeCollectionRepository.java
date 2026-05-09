package com.humanad.makit.knowledge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KnowledgeCollectionRepository extends JpaRepository<KnowledgeCollection, UUID> {
    List<KnowledgeCollection> findAllByArchivedFalseOrderBySortOrderAscCreatedAtAsc();
    List<KnowledgeCollection> findAllByOwnerIdOrderByCreatedAtAsc(UUID ownerId);
}
