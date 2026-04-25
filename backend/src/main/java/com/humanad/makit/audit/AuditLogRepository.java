package com.humanad.makit.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    /**
     * Count cumulative requests for a user (total audit_logs rows).
     */
    long countByUserId(UUID userId);

    /**
     * Find the most recent login event for a user.
     */
    Optional<AuditLog> findFirstByUserIdAndActionOrderByCreatedAtDesc(UUID userId, String action);

    /**
     * Paginated user activity history, ordered by creation time descending.
     */
    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /**
     * Find top N resources (service keys) by usage frequency for a user.
     * Returns List<Object[]> where each element is [resource, count].
     */
    @Query("""
        SELECT a.resource AS resource, COUNT(a) AS cnt
        FROM AuditLog a
        WHERE a.userId = :userId AND a.resource IS NOT NULL
        GROUP BY a.resource
        ORDER BY COUNT(a) DESC
    """)
    List<Object[]> findTopResourcesByUser(@Param("userId") UUID userId, Pageable pageable);

    /**
     * Find activity count grouped by date for a user over the last N days.
     * Uses native SQL to format dates in user's timezone (Asia/Seoul).
     *
     * Returns List<Object[]> where each element is [date (YYYY-MM-DD string), count].
     * Ordered by date ascending (oldest first).
     */
    @Query(value = """
        SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
               COUNT(*) AS cnt
        FROM audit_logs
        WHERE user_id = :userId AND created_at >= now() - (:days || ' days')::interval
        GROUP BY day
        ORDER BY day ASC
        """, nativeQuery = true)
    List<Object[]> findActivityByDay(@Param("userId") UUID userId, @Param("days") int days);
}
