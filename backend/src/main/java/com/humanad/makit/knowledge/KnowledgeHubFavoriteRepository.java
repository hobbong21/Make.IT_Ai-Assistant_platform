package com.humanad.makit.knowledge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KnowledgeHubFavoriteRepository
        extends JpaRepository<KnowledgeHubFavorite, KnowledgeHubFavorite.PK> {

    List<KnowledgeHubFavorite> findAllByUserId(UUID userId);

    boolean existsByUserIdAndDocumentId(UUID userId, UUID documentId);

    void deleteByUserIdAndDocumentId(UUID userId, UUID documentId);

    long countByDocumentId(UUID documentId);
}
