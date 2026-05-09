package com.humanad.makit.knowledge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface KnowledgeCollectionMemberRepository
        extends JpaRepository<KnowledgeCollectionMember, KnowledgeCollectionMember.PK> {

    Optional<KnowledgeCollectionMember> findByCollectionIdAndUserId(UUID collectionId, UUID userId);

    List<KnowledgeCollectionMember> findAllByCollectionId(UUID collectionId);
}
