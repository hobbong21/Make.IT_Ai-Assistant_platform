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

    /**
     * 같은 contextId에 달린 helpful/notHelpful 카운트.
     * 결과: {@code [Long helpful, Long notHelpful]} 한 행. 피드백이 없으면 [0, 0].
     * 느린 호출 상세 패널에서 "이 호출에 대한 사용자 평가가 어떘는가"를
     * 한 번에 보여주는 용도.
     */
    @Query("""
           SELECT SUM(CASE WHEN f.helpful = TRUE  THEN 1 ELSE 0 END),
                  SUM(CASE WHEN f.helpful = FALSE THEN 1 ELSE 0 END)
             FROM OfficeHubFeedback f
            WHERE f.contextId = :contextId
           """)
    List<Object[]> countByContextId(@Param("contextId") String contextId);

    /**
     * 같은 contextId에 달린 피드백 행을 최신순으로. 상세 패널에서 가장 최근
     * 코멘트 1~3건을 그대로 보여주기 위함. {@link Pageable}로 N건 제한.
     */
    @Query("""
           SELECT f
             FROM OfficeHubFeedback f
            WHERE f.contextId = :contextId
            ORDER BY f.createdAt DESC
           """)
    List<OfficeHubFeedback> findByContextId(@Param("contextId") String contextId, Pageable pageable);

    /**
     * 여러 contextId에 대한 helpful/notHelpful 카운트를 한 번에 집계한다.
     * 결과: {@code [String contextId, Long helpful, Long notHelpful]} 행들.
     * 느린 호출 목록 화면에서 행마다 "👎가 달렸는지"를 한눈에 보여주기 위한 배치 조회.
     * 피드백이 한 건도 없는 contextId는 결과에 포함되지 않으므로 호출 측에서 0으로 처리한다.
     */
    @Query("""
           SELECT f.contextId,
                  SUM(CASE WHEN f.helpful = TRUE  THEN 1 ELSE 0 END),
                  SUM(CASE WHEN f.helpful = FALSE THEN 1 ELSE 0 END)
             FROM OfficeHubFeedback f
            WHERE f.contextId IN :contextIds
            GROUP BY f.contextId
           """)
    List<Object[]> countByContextIds(@Param("contextIds") List<String> contextIds);
}
