package com.humanad.makit.knowledge.ai;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * @DataJpaTest 단위: {@link OfficeHubFeedbackRepository#countByContextId} /
 * {@link OfficeHubFeedbackRepository#findByContextId}.
 *
 * <p>이 두 메서드는 관리자 화면의 "느린 호출 + 사용자 피드백 요약" 패널
 * (GET /api/admin/ai/slow/detail/feedback)에서 helpful/notHelpful 카운트와
 * 최근 코멘트 1~3건을 만드는 핵심이다. 카운트가 어긋나면 운영자가
 * 잘못된 우선순위로 작업하므로, 회귀 방지 테스트가 필요하다.
 *
 * <p>application-test.yml의 H2(PostgreSQL 모드) DB와 ddl-auto=create-drop을
 * 사용해 실제 SQL/JPQL을 실행한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@ActiveProfiles("test")
class OfficeHubFeedbackRepositoryTest {

    @Autowired OfficeHubFeedbackRepository repo;

    private OfficeHubFeedback save(String contextId, boolean helpful,
                                   String action, String comment, OffsetDateTime createdAt) {
        OfficeHubFeedback f = new OfficeHubFeedback();
        f.setContextId(contextId);
        f.setHelpful(helpful);
        f.setAction(action);
        f.setComment(comment);
        f.setCreatedAt(createdAt);
        return repo.saveAndFlush(f);
    }

    @Test
    void countByContextId_returnsZeroWhenNoFeedback() {
        // 다른 contextId에 데이터가 있어도 대상 contextId 결과는 영향 없어야 함.
        save("other-ctx", true, "ask", null,
                OffsetDateTime.of(2026, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC));

        List<Object[]> rows = repo.countByContextId("missing-ctx");
        assertThat(rows).hasSize(1);
        Object[] r = rows.get(0);
        // SUM은 매칭되는 행이 없으면 NULL을 돌려준다 → 컨트롤러가 NULL 가드를 한다.
        assertThat(r[0]).isNull();
        assertThat(r[1]).isNull();
    }

    @Test
    void countByContextId_aggregatesHelpfulAndNotHelpful() {
        OffsetDateTime t = OffsetDateTime.of(2026, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        save("ctx-1", true,  "ask", "good",   t);
        save("ctx-1", true,  "ask", "great",  t.plusMinutes(1));
        save("ctx-1", false, "ask", "wrong",  t.plusMinutes(2));
        // 다른 contextId의 행은 카운트에 섞여서는 안 된다.
        save("ctx-2", false, "ask", "bad",    t);

        List<Object[]> rows = repo.countByContextId("ctx-1");
        assertThat(rows).hasSize(1);
        Object[] r = rows.get(0);
        assertThat(((Number) r[0]).longValue()).isEqualTo(2L);
        assertThat(((Number) r[1]).longValue()).isEqualTo(1L);
    }

    @Test
    void findByContextId_returnsRowsOrderedByCreatedAtDesc_limitedByPageable() {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        save("ctx-1", true,  "ask", "first",  t0);
        save("ctx-1", false, "ask", "second", t0.plusMinutes(1));
        save("ctx-1", true,  "ask", "third",  t0.plusMinutes(2));
        save("ctx-1", false, "ask", "fourth", t0.plusMinutes(3));
        save("ctx-2", true,  "ask", "other",  t0.plusMinutes(5));

        List<OfficeHubFeedback> recent = repo.findByContextId("ctx-1", PageRequest.of(0, 3));
        // 최신순 3건만, 다른 contextId는 제외.
        assertThat(recent).extracting(OfficeHubFeedback::getComment)
                .containsExactly("fourth", "third", "second");
    }

    @Test
    void findByContextId_emptyWhenNoMatch() {
        save("ctx-1", true, "ask", "only",
                OffsetDateTime.of(2026, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC));
        assertThat(repo.findByContextId("missing-ctx", PageRequest.of(0, 3))).isEmpty();
    }
}
