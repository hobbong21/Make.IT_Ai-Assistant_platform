package com.humanad.makit.admin;

import com.humanad.makit.knowledge.ai.OfficeHubFeedback;
import com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepository;
import com.humanad.makit.testsupport.TestcontainersSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end 통합 테스트: GET {@code /api/admin/ai/slow/detail/feedback}.
 *
 * <p>{@link AiQualityControllerTest}는 mock 레포로, {@link
 * com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepositoryTest}는 H2(@DataJpaTest)로
 * 각각 단위 검증한다. 본 테스트는 컨트롤러 → 레포 → 실제 Postgres → JSON 직렬화까지
 * 한 번에 통과하는 경로를 회귀 보호한다. 특히
 * <ul>
 *   <li>{@code @PreAuthorize("hasRole('ADMIN')")} 가드가 실제 필터 체인에서
 *       401/403을 돌려주는지,</li>
 *   <li>응답 JSON 형태가 프런트({@code admin.js})가 기대하는 키
 *       ({@code helpful}, {@code notHelpful}, {@code recentComments[]})와
 *       정렬(최신순) / 한도(3건)를 유지하는지,</li>
 *   <li>{@code SUM(CASE ...)} 가 매칭 행 0건일 때 NULL을 돌려주는 Postgres 동작과
 *       컨트롤러의 NULL 가드가 함께 0/0/[]을 보장하는지</li>
 * </ul>
 * 를 확인한다.
 *
 * <p>Docker 가용성 정책 — 프로젝트 컨벤션 {@link TestcontainersSupport}와 정렬:
 * <ul>
 *   <li>로컬에서 Docker 데몬이 없으면 graceful skip
 *       ({@code @Testcontainers(disabledWithoutDocker = true)}).</li>
 *   <li>CI 등에서 {@code REQUIRE_DOCKER_TESTS=true} 가 설정된 경우엔 회귀 공백을
 *       막기 위해 정적 초기화 시점에 즉시 실패시킨다 (아래 static 블록).</li>
 * </ul>
 *
 * <p>컨테이너는 {@code @Container} 정적 필드로 선언해 Testcontainers JUnit5
 * 확장이 클래스 시작/종료 시점에 결정적으로 start/stop을 관리하도록 한다 —
 * 정적 초기화 블록에서 직접 start만 호출하던 패턴은 컨테이너 누수 가능성이 있어
 * 피한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class AiQualitySlowDetailFeedbackIntegrationTest {

    static {
        // CI에서 REQUIRE_DOCKER_TESTS=true 라면 Docker 부재를 silent skip 하지 않고
        // 즉시 실패시킨다 (TestcontainersSupport 컨벤션). 환경변수가 없으면
        // disabledWithoutDocker=true 가 graceful skip 을 처리하므로 no-op.
        if (TestcontainersSupport.isDockerRequired()) {
            TestcontainersSupport.requireDockerOrSkip(
                    "AiQualitySlowDetailFeedbackIntegrationTest needs Postgres + Redis containers");
        }
    }

    // pgvector/pgvector:pg16 — Flyway V00000001 가 CREATE EXTENSION "vector"를 실행하므로
    // 표준 postgres 이미지로는 마이그레이션이 깨진다. pg16 변종이 pgvector + pgcrypto를
    // 모두 포함한다.
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstitutingFor("postgres"))
            .withDatabaseName("makit_test")
            .withUsername("makit_test")
            .withPassword("makit_test");

    // SlowCallSampler 와 RefreshTokenService 가 RedisTemplate을 주입받는다 — 컨텍스트
    // 부팅을 위해 가벼운 Redis 컨테이너를 함께 띄운다. 본 테스트는 Redis에 직접
    // 의존하지 않지만, 빈 와이어링 실패를 막기 위함.
    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>(
            DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",      POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        // Flyway가 모든 마이그레이션을 실행 — office_hub_ai_feedback 테이블 포함.
        r.add("spring.flyway.enabled",      () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");

        r.add("spring.data.redis.host", REDIS::getHost);
        r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));

        // Bedrock SDK 부팅 회피 — MockBedrockService 가 활성화된다.
        r.add("aws.bedrock.enabled", () -> "false");

        // 테스트용 JWT secret (auth 빈 부팅에 필요).
        r.add("jwt.secret", () -> "dGVzdC1zZWNyZXQtMzItYnl0ZS1taW5pbXVtLWZvci1obWFjLXNoYTI1Ng==");
    }

    @Autowired MockMvc mvc;
    @Autowired OfficeHubFeedbackRepository feedbackRepo;

    @AfterEach
    void cleanup() {
        feedbackRepo.deleteAll();
    }

    private void seed(String contextId, boolean helpful, String action,
                      String comment, OffsetDateTime createdAt) {
        OfficeHubFeedback f = new OfficeHubFeedback();
        f.setContextId(contextId);
        f.setHelpful(helpful);
        f.setAction(action);
        f.setComment(comment);
        f.setCreatedAt(createdAt);
        feedbackRepo.saveAndFlush(f);
    }

    // ------------------------------------------------------------------ ADMIN 권한 가드

    @Test
    void anonymous_isUnauthorized() throws Exception {
        mvc.perform(get("/api/admin/ai/slow/detail/feedback").param("contextId", "ctx-x"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void nonAdmin_isForbidden() throws Exception {
        mvc.perform(get("/api/admin/ai/slow/detail/feedback").param("contextId", "ctx-x"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ 200 응답 형태

    @Test
    @WithMockUser(roles = "ADMIN")
    void admin_returnsAggregatedCountsAndRecentCommentsNewestFirst() throws Exception {
        OffsetDateTime t0 = OffsetDateTime.of(2026, 5, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        // 같은 contextId — helpful 2 / notHelpful 3.
        seed("ctx-1", true,  "ask", "good",   t0.plusMinutes(1));
        seed("ctx-1", true,  "ask", "great",  t0.plusMinutes(2));
        seed("ctx-1", false, "ask", "wrong1", t0.plusMinutes(3));
        seed("ctx-1", false, "ask", "wrong2", t0.plusMinutes(4));
        seed("ctx-1", false, "ask", "newest", t0.plusMinutes(5));
        // 다른 contextId — 카운트에 섞이면 안 됨.
        seed("ctx-2", true,  "ask", "other",  t0.plusMinutes(10));

        mvc.perform(get("/api/admin/ai/slow/detail/feedback").param("contextId", "ctx-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(2))
                .andExpect(jsonPath("$.notHelpful").value(3))
                // recentComments: 최신순, 최대 3건.
                .andExpect(jsonPath("$.recentComments", hasSize(3)))
                .andExpect(jsonPath("$.recentComments[0].comment").value("newest"))
                .andExpect(jsonPath("$.recentComments[0].helpful").value(false))
                .andExpect(jsonPath("$.recentComments[1].comment").value("wrong2"))
                .andExpect(jsonPath("$.recentComments[2].comment").value("wrong1"))
                .andExpect(jsonPath("$.recentComments[0].action").value("ask"))
                // createdAt 도 최신순으로 단조 감소(monotonic decreasing) 인지 확인 —
                // 정렬 보장을 명시적으로 회귀 잡는다. JsonPath comparator 가 없으므로
                // 각 시점이 우리가 seed 한 분 단위 timestamp 와 일치하는지로 검증.
                .andExpect(jsonPath("$.recentComments[0].createdAt")
                        .value(t0.plusMinutes(5).toString()))
                .andExpect(jsonPath("$.recentComments[1].createdAt")
                        .value(t0.plusMinutes(4).toString()))
                .andExpect(jsonPath("$.recentComments[2].createdAt")
                        .value(t0.plusMinutes(3).toString()));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void admin_unknownContextId_returnsZerosAndEmptyComments() throws Exception {
        // SUM(CASE ...) 매칭 행 0건 → Postgres 가 NULL 한 행을 돌려준다. 컨트롤러의
        // NULL 가드가 0으로 변환해야 한다.
        seed("ctx-existing", true, "ask", "x",
                OffsetDateTime.of(2026, 5, 1, 0, 0, 0, 0, ZoneOffset.UTC));

        mvc.perform(get("/api/admin/ai/slow/detail/feedback").param("contextId", "ctx-missing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(0))
                .andExpect(jsonPath("$.notHelpful").value(0))
                .andExpect(jsonPath("$.recentComments", hasSize(0)));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void admin_blankContextId_returnsZerosAndEmptyComments() throws Exception {
        // 빈 contextId — 컨트롤러 short-circuit. DB 미존재 행도 동일 응답이어야 함.
        mvc.perform(get("/api/admin/ai/slow/detail/feedback").param("contextId", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.helpful").value(0))
                .andExpect(jsonPath("$.notHelpful").value(0))
                .andExpect(jsonPath("$.recentComments", hasSize(0)));
    }
}
