package com.humanad.makit.marketing.content;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ContentRepository extends JpaRepository<Content, Long> {

    List<Content> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Content> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, Content.Status status);

    @Query("SELECT COUNT(c) FROM Content c WHERE c.userId = :userId")
    int countByUserId(@Param("userId") UUID userId);

    @Query("SELECT COUNT(c) FROM Content c WHERE c.userId = :userId AND c.status = 'PUBLISHED' AND c.createdAt >= :since")
    int countPublishedSince(@Param("userId") UUID userId, @Param("since") OffsetDateTime since);
}
