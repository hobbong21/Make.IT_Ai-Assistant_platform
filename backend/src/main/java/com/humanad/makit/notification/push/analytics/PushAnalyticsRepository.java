package com.humanad.makit.notification.push.analytics;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public interface PushAnalyticsRepository extends JpaRepository<PushAnalyticsEntity, Long> {

    /**
     * Find all analytics events for a user, ordered by creation date (newest first).
     */
    Page<PushAnalyticsEntity> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    /**
     * Count analytics events by user and event type within a time range.
     */
    long countByUserIdAndEventTypeAndCreatedAtAfter(UUID userId, PushAnalyticsEntity.EventType eventType, OffsetDateTime startTime);

    /**
     * Aggregate stats: {sent: long, clicked: long, failed: long, expired: long, ctr: double}
     * for the last N days.
     */
    @Query(value = """
        SELECT
          COUNT(CASE WHEN event_type = 'SENT' THEN 1 END) as sent,
          COUNT(CASE WHEN event_type = 'CLICKED' THEN 1 END) as clicked,
          COUNT(CASE WHEN event_type = 'FAILED' THEN 1 END) as failed,
          COUNT(CASE WHEN event_type = 'EXPIRED' THEN 1 END) as expired
        FROM push_analytics
        WHERE user_id = :userId
          AND created_at >= :startTime
        """, nativeQuery = true)
    Map<String, Long> getAggregateStats(UUID userId, OffsetDateTime startTime);

    /**
     * Get daily stats: list of {date, sent, clicked} for last N days.
     */
    @Query(value = """
        SELECT
          to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') as date,
          COUNT(CASE WHEN event_type = 'SENT' THEN 1 END) as sent,
          COUNT(CASE WHEN event_type = 'CLICKED' THEN 1 END) as clicked
        FROM push_analytics
        WHERE user_id = :userId
          AND created_at >= :startTime
        GROUP BY to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
        ORDER BY date DESC
        """, nativeQuery = true)
    List<Map<String, Object>> getDailyStats(UUID userId, OffsetDateTime startTime);
}
