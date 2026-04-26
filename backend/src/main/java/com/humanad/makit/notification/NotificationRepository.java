package com.humanad.makit.notification;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    long countByUserIdAndReadAtIsNull(UUID userId);

    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.userId = :userId AND n.readAt IS NULL")
    int markAllRead(@Param("userId") UUID userId);

    /**
     * Count notifications by type created in the last N days (admin dashboard).
     * Returns List<Object[]> where each element is [type, count].
     */
    @Query(value = """
        SELECT type, COUNT(*) AS cnt
        FROM notifications
        WHERE created_at >= now() - (:days || ' days')::interval
        GROUP BY type
        ORDER BY cnt DESC
        """, nativeQuery = true)
    List<Object[]> countByTypeLastDays(@Param("days") int days);

    /**
     * Count total notifications created in the last N days.
     */
    @Query("""
        SELECT COUNT(n) FROM Notification n
        WHERE n.createdAt >= :since
    """)
    long countSince(@Param("since") OffsetDateTime since);

    /**
     * Count unread notifications created in the last N days.
     */
    @Query("""
        SELECT COUNT(n) FROM Notification n
        WHERE n.createdAt >= :since AND n.readAt IS NULL
    """)
    long countUnreadSince(@Param("since") OffsetDateTime since);
}
