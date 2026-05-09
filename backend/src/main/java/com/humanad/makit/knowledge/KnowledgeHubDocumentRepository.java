package com.humanad.makit.knowledge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface KnowledgeHubDocumentRepository extends JpaRepository<KnowledgeHubDocument, UUID> {

    List<KnowledgeHubDocument> findAllByCollectionIdAndStatusNotOrderByUpdatedAtDesc(
            UUID collectionId, DocStatus excluded);

    List<KnowledgeHubDocument> findAllByStatusOrderByUpdatedAtDesc(DocStatus status);

    long countByCollectionIdAndStatusNot(UUID collectionId, DocStatus excluded);

    @Query("""
            select d from KnowledgeHubDocument d
            where d.status <> com.humanad.makit.knowledge.DocStatus.TRASH
              and (lower(d.title) like lower(concat('%', :q, '%'))
                   or lower(d.bodyMd) like lower(concat('%', :q, '%')))
            order by d.updatedAt desc
            """)
    List<KnowledgeHubDocument> searchActive(@Param("q") String q);
}
