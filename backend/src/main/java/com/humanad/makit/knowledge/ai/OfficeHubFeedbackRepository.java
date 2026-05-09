package com.humanad.makit.knowledge.ai;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface OfficeHubFeedbackRepository extends JpaRepository<OfficeHubFeedback, UUID> {

    long countByActionAndHelpful(String action, boolean helpful);

    /**
     * UTC 기준 일자별 helpful/notHelpful 집계. 결과 행은 {@code [java.sql.Date d,
     * Long helpful, Long notHelpful]}. JPQL에서 Postgres 의존적 함수 호출을 피하기
     * 위해 native query를 사용.
     */
    @Query(value = """
            SELECT CAST(created_at AT TIME ZONE 'UTC' AS DATE)              AS d,
                   SUM(CASE WHEN helpful THEN 1 ELSE 0 END)                 AS h,
                   SUM(CASE WHEN helpful THEN 0 ELSE 1 END)                 AS n
              FROM office_hub_ai_feedback
             WHERE created_at >= :since
             GROUP BY CAST(created_at AT TIME ZONE 'UTC' AS DATE)
             ORDER BY d ASC
            """, nativeQuery = true)
    List<Object[]> aggregateDaily(@Param("since") OffsetDateTime since);

    /** 액션별 helpful/notHelpful 집계. 결과: {@code [String action, Long h, Long n]}. */
    @Query("""
           SELECT f.action,
                  SUM(CASE WHEN f.helpful = TRUE  THEN 1 ELSE 0 END),
                  SUM(CASE WHEN f.helpful = FALSE THEN 1 ELSE 0 END)
             FROM OfficeHubFeedback f
            WHERE f.createdAt >= :since
            GROUP BY f.action
            ORDER BY f.action ASC
           """)
    List<Object[]> aggregateByAction(@Param("since") OffsetDateTime since);

    /** 피드백이 가장 많이 달린 문서 Top N. 결과: {@code [String documentId, Long count]}. */
    @Query("""
           SELECT f.documentId, COUNT(f)
             FROM OfficeHubFeedback f
            WHERE f.createdAt >= :since
              AND f.documentId IS NOT NULL
            GROUP BY f.documentId
            ORDER BY COUNT(f) DESC
           """)
    List<Object[]> topDocuments(@Param("since") OffsetDateTime since, Pageable pageable);
}
