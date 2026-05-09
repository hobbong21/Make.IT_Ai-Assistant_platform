package com.humanad.makit.knowledge.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

import com.humanad.makit.testsupport.TestcontainersSupport;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 Redis(Testcontainers)에 붙여서 {@link SlowCallSampler}의 LPUSH/LTRIM/EXPIRE
 * 직렬화/정렬/TTL 동작을 검증한다. 기존 {@link SlowCallSamplerTest}가 mock으로 가렸던
 * 영역(Jackson 직렬화 라운드트립, Redis 명령 정확도, 인스턴스 간 표본 공유)을
 * 회귀 보호한다.
 *
 * <p>Docker 데몬이 없는 환경에서는 graceful skip 한다 — 로컬에서 안전하게 동작.
 * 단, CI에서는 {@code REQUIRE_DOCKER_TESTS=true} 환경 변수로 skip 대신
 * 빌드 실패를 강제한다 ({@link TestcontainersSupport} 참고).
 */
class SlowCallSamplerRedisIntegrationTest {

    private static GenericContainer<?> redisContainer;
    private static LettuceConnectionFactory connectionFactory;
    private static StringRedisTemplate redisTemplate;
    private static ObjectMapper mapper;

    @BeforeAll
    static void startRedis() {
        TestcontainersSupport.requireDockerOrSkip(
                "SlowCallSamplerRedisIntegrationTest needs a Docker daemon to spin up redis:7-alpine");

        redisContainer = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                .withExposedPorts(6379);
        redisContainer.start();

        RedisStandaloneConfiguration cfg = new RedisStandaloneConfiguration(
                redisContainer.getHost(), redisContainer.getMappedPort(6379));
        connectionFactory = new LettuceConnectionFactory(cfg);
        connectionFactory.afterPropertiesSet();

        redisTemplate = new StringRedisTemplate(connectionFactory);
        redisTemplate.afterPropertiesSet();

        mapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @AfterAll
    static void stopRedis() {
        if (connectionFactory != null) connectionFactory.destroy();
        if (redisContainer != null) redisContainer.stop();
    }

    @BeforeEach
    void flush() {
        // 키 충돌 방지 — 매 테스트가 빈 Redis로 시작하도록 한다.
        // RedisCallback 으로 감싸 connection 누수를 막는다.
        redisTemplate.execute((RedisCallback<Object>) conn -> {
            conn.serverCommands().flushAll();
            return null;
        });
    }

    @Test
    void recordAndRecent_roundTripThroughRealRedis() {
        SlowCallSampler s = new SlowCallSampler(redisTemplate, mapper);

        s.record("ask", "col1", 500, "ctx1", "왜 느리지?", "claude-haiku");
        s.record("ask", "col1", 1500, "ctx2", "두번째 질문", "claude-haiku");
        s.record("ask", "col1", 200, "ctx3", "빠른 호출", "claude-haiku");

        List<SlowCallSampler.Sample> recent = s.recent("ask", "col1", 10);

        assertThat(recent).hasSize(3);
        // recent()는 latencyMs 내림차순 정렬: 1500, 500, 200
        assertThat(recent).extracting(SlowCallSampler.Sample::latencyMs)
                .containsExactly(1500L, 500L, 200L);
        assertThat(recent.get(0).contextId()).isEqualTo("ctx2");
        assertThat(recent.get(0).question()).isEqualTo("두번째 질문");

        // EXPIRE 가 적용되어 있어야 한다 — TTL > 0 (정확히 7일 ± 약간).
        Long ttl = redisTemplate.getExpire("makit:ai:slow:ask:col1");
        assertThat(ttl).isNotNull();
        assertThat(ttl).isPositive();
        assertThat(ttl).isLessThanOrEqualTo(SlowCallSampler.TTL.getSeconds());
        assertThat(ttl).isGreaterThan(SlowCallSampler.TTL.getSeconds() - 60);
    }

    @Test
    void capacityIsEnforcedByLtrim() {
        SlowCallSampler s = new SlowCallSampler(redisTemplate, mapper);

        for (int i = 0; i < SlowCallSampler.CAPACITY + 5; i++) {
            s.record("ask", "colX", i, "ctx" + i, "q" + i, "m");
        }

        // Redis List 의 실제 길이가 CAPACITY 로 제한되어야 한다.
        Long size = redisTemplate.opsForList().size("makit:ai:slow:ask:colX");
        assertThat(size).isEqualTo((long) SlowCallSampler.CAPACITY);

        List<SlowCallSampler.Sample> recent = s.recent("ask", "colX", 100);
        assertThat(recent).hasSize(SlowCallSampler.CAPACITY);
        // 가장 최근 기록(가장 큰 latencyMs) 이 헤드에 살아있어야 한다.
        assertThat(recent.get(0).latencyMs())
                .isEqualTo(SlowCallSampler.CAPACITY + 5 - 1);
    }

    @Test
    void samplesPersistAcrossInstances_simulatingRestart() {
        // 인스턴스 A 가 기록한다.
        SlowCallSampler writer = new SlowCallSampler(redisTemplate, mapper);
        writer.record("ask", "policy", 800, "ctx-A", "A 질문", "m");
        writer.record("ask", "policy", 1200, "ctx-B", "B 질문", "m");

        // 인스턴스 B (재시작/스케일아웃 후 새 JVM 을 흉내낸다) — 동일 Redis 에 붙어
        // 같은 표본을 봐야 한다. in-memory fallback 으로는 불가능한 시나리오.
        SlowCallSampler reader = new SlowCallSampler(redisTemplate, mapper);
        List<SlowCallSampler.Sample> recent = reader.recent("ask", "policy", 10);

        assertThat(recent).hasSize(2);
        assertThat(recent).extracting(SlowCallSampler.Sample::contextId)
                .containsExactly("ctx-B", "ctx-A");
    }

    @Test
    void differentTagsAreIsolatedAcrossKeys() {
        SlowCallSampler s = new SlowCallSampler(redisTemplate, mapper);
        s.record("ask", "col-a", 100, "x", "qa", "m");
        s.record("ask", "col-b", 999, "y", "qb", "m");
        s.record("action", "summarize", 222, "z", "doc", "m");

        // 각 키가 독립적으로 보관되는지 확인.
        assertThat(redisTemplate.opsForList().size("makit:ai:slow:ask:col-a")).isEqualTo(1L);
        assertThat(redisTemplate.opsForList().size("makit:ai:slow:ask:col-b")).isEqualTo(1L);
        assertThat(redisTemplate.opsForList().size("makit:ai:slow:action:summarize")).isEqualTo(1L);

        assertThat(s.recent("ask", "col-a", 10))
                .singleElement().extracting(SlowCallSampler.Sample::tag).isEqualTo("col-a");
        assertThat(s.recent("ask", "col-b", 10))
                .singleElement().extracting(SlowCallSampler.Sample::latencyMs).isEqualTo(999L);
        assertThat(s.recent("action", "summarize", 10))
                .singleElement().extracting(SlowCallSampler.Sample::kind).isEqualTo("action");
    }

    @Test
    void shortTtlExpiresKeyAutomatically() throws InterruptedException {
        // TTL 만료 시 키가 사라지는지 검증. SlowCallSampler 의 TTL(7일)을 줄일 수
        // 없으므로, 같은 Redis 에 짧은 TTL 로 직접 키를 만들어 만료를 시뮬레이션한다.
        // (운영용 키와 동일한 prefix 를 쓰지만, 이 테스트는 격리된 컨테이너 안에서만 동작.)
        String key = "makit:ai:slow:ask:short-ttl-probe";
        redisTemplate.opsForList().leftPush(key, "{}");
        redisTemplate.expire(key, Duration.ofSeconds(1));
        assertThat(redisTemplate.hasKey(key)).isTrue();

        // 1초 TTL + 약간 여유. 비결정성 회피용 폴링.
        long deadline = System.currentTimeMillis() + 5_000;
        while (System.currentTimeMillis() < deadline && Boolean.TRUE.equals(redisTemplate.hasKey(key))) {
            Thread.sleep(100);
        }
        assertThat(redisTemplate.hasKey(key))
                .as("Redis 가 TTL 만료 후 키를 자동 제거해야 한다")
                .isFalse();
    }
}
