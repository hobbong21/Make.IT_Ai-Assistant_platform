package com.humanad.makit.knowledge.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link SlowCallSampler} 단위 테스트.
 *
 * <p>두 묶음으로 나뉜다:
 * <ul>
 *   <li>{@link RedisBackedSamples} — Sample ring buffer가 Redis-backed 모드에서
 *       인스턴스를 가로질러 같은 표본을 노출하는지(=재시작/스케일아웃 후에도
 *       손실되지 않는지)와 in-memory fallback이 정상 동작하는지를 검증.
 *       Mock {@link StringRedisTemplate}을 단순 in-process Map으로 backing.</li>
 *   <li>{@link DetailStore} — contextId 키 LRU detail 저장(모달 본문 노출 지원)의
 *       라운드트립/입력 정규화/eviction 동작을 검증.</li>
 * </ul>
 */
class SlowCallSamplerTest {

    @Nested
    class RedisBackedSamples {

        private StringRedisTemplate redis;
        private Map<String, List<String>> store;
        private ObjectMapper mapper;

        @BeforeEach
        @SuppressWarnings("unchecked")
        void setUp() {
            redis = mock(StringRedisTemplate.class);
            store = new HashMap<>();
            mapper = new ObjectMapper().registerModule(new JavaTimeModule());

            ListOperations<String, String> ops = mock(ListOperations.class);
            when(redis.opsForList()).thenReturn(ops);

            when(ops.leftPush(anyString(), anyString())).thenAnswer(inv -> {
                String key = inv.getArgument(0);
                String val = inv.getArgument(1);
                store.computeIfAbsent(key, k -> new ArrayList<>()).add(0, val);
                return (long) store.get(key).size();
            });

            doAnswer(inv -> {
                String key = inv.getArgument(0);
                long start = inv.getArgument(1);
                long end = inv.getArgument(2);
                List<String> l = store.get(key);
                if (l == null) return null;
                int from = (int) Math.max(0, start);
                int to = (int) Math.min(l.size() - 1, end);
                if (from > to) { l.clear(); return null; }
                List<String> kept = new ArrayList<>(l.subList(from, to + 1));
                l.clear();
                l.addAll(kept);
                return null;
            }).when(ops).trim(anyString(), anyLong(), anyLong());

            when(ops.range(anyString(), anyLong(), anyLong())).thenAnswer(inv -> {
                String key = inv.getArgument(0);
                return new ArrayList<>(store.getOrDefault(key, List.of()));
            });

            when(redis.expire(anyString(), any(Duration.class))).thenReturn(true);

            when(ops.size(anyString())).thenAnswer(inv -> {
                String key = inv.getArgument(0);
                List<String> l = store.get(key);
                return l == null ? 0L : (long) l.size();
            });
            when(redis.delete(anyString())).thenAnswer(inv -> {
                String key = inv.getArgument(0);
                return store.remove(key) != null;
            });
        }

        @Test
        void samplesPersistAcrossInstances_viaRedis() {
            SlowCallSampler writer = new SlowCallSampler(redis, mapper);
            writer.record("ask", "col1", 500, "ctx1", "왜 느리지?", "claude-haiku");
            writer.record("ask", "col1", 1500, "ctx2", "두번째 질문", "claude-haiku");
            writer.record("ask", "col1", 200, "ctx3", "빠른 호출", "claude-haiku");

            // "재시작" 시뮬레이션: 새 SlowCallSampler 인스턴스로 같은 Redis에서 읽기.
            SlowCallSampler reader = new SlowCallSampler(redis, mapper);
            List<SlowCallSampler.Sample> recent = reader.recent("ask", "col1", 10);

            assertThat(recent).hasSize(3);
            // latencyMs 내림차순 정렬: 1500, 500, 200
            assertThat(recent).extracting(SlowCallSampler.Sample::latencyMs)
                    .containsExactly(1500L, 500L, 200L);
            assertThat(recent.get(0).contextId()).isEqualTo("ctx2");
            assertThat(recent.get(0).question()).isEqualTo("두번째 질문");
        }

        @Test
        void capacityIsEnforcedAcrossWrites() {
            SlowCallSampler s = new SlowCallSampler(redis, mapper);
            // CAPACITY(20) 초과 기록 후, 읽으면 정확히 20건만 남아야 한다.
            for (int i = 0; i < SlowCallSampler.CAPACITY + 5; i++) {
                s.record("ask", "colX", i, "ctx" + i, "q" + i, "m");
            }
            List<SlowCallSampler.Sample> recent = s.recent("ask", "colX", 100);
            assertThat(recent).hasSize(SlowCallSampler.CAPACITY);
        }

        @Test
        void differentTagsAreIsolated() {
            SlowCallSampler s = new SlowCallSampler(redis, mapper);
            s.record("ask", "col-a", 100, "x", "qa", "m");
            s.record("ask", "col-b", 999, "y", "qb", "m");
            s.record("action", "summarize", 222, "z", "doc", "m");

            assertThat(s.recent("ask", "col-a", 10))
                    .singleElement().extracting(SlowCallSampler.Sample::tag).isEqualTo("col-a");
            assertThat(s.recent("ask", "col-b", 10))
                    .singleElement().extracting(SlowCallSampler.Sample::latencyMs).isEqualTo(999L);
            assertThat(s.recent("action", "summarize", 10))
                    .singleElement().extracting(SlowCallSampler.Sample::kind).isEqualTo("action");
        }

        @Test
        void clear_removesRedisKey_andReturnsCount() {
            SlowCallSampler s = new SlowCallSampler(redis, mapper);
            s.record("ask", "col1", 100, "c1", "q1", "m");
            s.record("ask", "col1", 200, "c2", "q2", "m");
            s.record("ask", "col2", 300, "c3", "q3", "m"); // 다른 태그는 영향 없어야 함

            int removed = s.clear("ask", "col1");

            assertThat(removed).isEqualTo(2);
            assertThat(s.recent("ask", "col1", 10)).isEmpty();
            // 다른 태그는 보존된다.
            assertThat(s.recent("ask", "col2", 10)).hasSize(1);
            verify(redis).delete("makit:ai:slow:ask:col1");
        }

        @Test
        void clear_alsoEvictsContextIdDetailsForSameTag() {
            SlowCallSampler s = new SlowCallSampler(redis, mapper);
            s.recordDetail("ask", "col1", 100, "ctx-keep", "q", "a", List.of(), 0, 0, "m");
            s.recordDetail("ask", "col1", 200, "ctx-keep-2", "q", "a", List.of(), 0, 0, "m");
            s.recordDetail("ask", "col2", 100, "ctx-other", "q", "a", List.of(), 0, 0, "m");

            int removed = s.clear("ask", "col1");

            assertThat(removed).isEqualTo(2); // 두 detail (Redis는 비어 있어 0)
            assertThat(s.findDetail("ctx-keep")).isEmpty();
            assertThat(s.findDetail("ctx-keep-2")).isEmpty();
            // 다른 태그의 detail은 보존된다.
            assertThat(s.findDetail("ctx-other")).isPresent();
        }

        @Test
        void fallsBackToInMemoryWhenRedisUnavailable() {
            // Redis 미설정 환경(=null) — 기존 in-memory 동작 보존.
            SlowCallSampler s = new SlowCallSampler();
            s.record("ask", "col1", 100, "ctx1", "q1", "m");
            s.record("ask", "col1", 300, "ctx2", "q2", "m");
            List<SlowCallSampler.Sample> recent = s.recent("ask", "col1", 10);
            assertThat(recent).hasSize(2);
            assertThat(recent.get(0).latencyMs()).isEqualTo(300L);
        }
    }

    /**
     * Focused tests for {@link SlowCallSampler}'s contextId-keyed detail store
     * (느린 샘플 모달의 contextId 클릭 시 답변/인용/토큰을 보여주는 기능 지원).
     */
    @Nested
    class DetailStore {

        @Test
        void recordDetail_andFindDetail_roundTrip() {
            SlowCallSampler s = new SlowCallSampler();
            List<SlowCallSampler.Citation> cits = List.of(
                    new SlowCallSampler.Citation("doc-1", "정책서", 0, 0.91, "발췌입니다."));

            s.recordDetail("ask", "policy", 1234, "ctx-1",
                    "환불 정책 알려줘", "환불은 7일 내 가능합니다.", cits, 120, 80, "claude-haiku");

            Optional<SlowCallSampler.Detail> got = s.findDetail("ctx-1");
            assertThat(got).isPresent();
            SlowCallSampler.Detail d = got.get();
            assertThat(d.contextId()).isEqualTo("ctx-1");
            assertThat(d.kind()).isEqualTo("ask");
            assertThat(d.tag()).isEqualTo("policy");
            assertThat(d.latencyMs()).isEqualTo(1234);
            assertThat(d.question()).isEqualTo("환불 정책 알려줘");
            assertThat(d.answer()).isEqualTo("환불은 7일 내 가능합니다.");
            assertThat(d.citations()).hasSize(1);
            assertThat(d.citations().get(0).documentId()).isEqualTo("doc-1");
            assertThat(d.tokensIn()).isEqualTo(120);
            assertThat(d.tokensOut()).isEqualTo(80);
            assertThat(d.modelId()).isEqualTo("claude-haiku");
        }

        @Test
        void findDetail_returnsEmptyForUnknownOrBlankContextId() {
            SlowCallSampler s = new SlowCallSampler();
            assertThat(s.findDetail(null)).isEmpty();
            assertThat(s.findDetail("")).isEmpty();
            assertThat(s.findDetail("nope")).isEmpty();
        }

        @Test
        void recordDetail_ignoresBlankContextId() {
            SlowCallSampler s = new SlowCallSampler();
            s.recordDetail("ask", "t", 10, "", "q", "a", List.of(), 0, 0, "m");
            s.recordDetail("ask", "t", 10, null, "q", "a", List.of(), 0, 0, "m");
            // Nothing stored — and there is no public way to enumerate, so the only
            // observable check is that no exception was thrown and findDetail returns empty.
            assertThat(s.findDetail("")).isEmpty();
        }

        @Test
        void recordDetail_truncatesLongAnswerAndSnippet() {
            SlowCallSampler s = new SlowCallSampler();
            String longAnswer = "x".repeat(SlowCallSampler.MAX_ANSWER + 500);
            String longSnippet = "y".repeat(SlowCallSampler.MAX_SNIPPET + 200);
            List<SlowCallSampler.Citation> cits = List.of(
                    new SlowCallSampler.Citation("d", "t", 0, 0.5, longSnippet));

            s.recordDetail("ask", "t", 1, "ctx-trunc", "q", longAnswer, cits, 0, 0, "m");

            SlowCallSampler.Detail d = s.findDetail("ctx-trunc").orElseThrow();
            assertThat(d.answer()).hasSize(SlowCallSampler.MAX_ANSWER + 3); // "..." 접미사
            assertThat(d.answer()).endsWith("...");
            assertThat(d.citations().get(0).snippet()).hasSize(SlowCallSampler.MAX_SNIPPET + 3);
            assertThat(d.citations().get(0).snippet()).endsWith("...");
        }

        @Test
        void recordDetail_evictsOldestWhenOverCapacity() {
            SlowCallSampler s = new SlowCallSampler();
            // 가장 오래된 항목이 LRU에서 밀려나는지 확인.
            for (int i = 0; i < SlowCallSampler.DETAIL_CAPACITY + 5; i++) {
                s.recordDetail("ask", "t", i, "ctx-" + i, "q", "a", List.of(), 0, 0, "m");
            }
            // 가장 오래된 5건은 사라졌어야 한다.
            for (int i = 0; i < 5; i++) {
                assertThat(s.findDetail("ctx-" + i)).as("ctx-%d should be evicted", i).isEmpty();
            }
            // 최근 항목은 남아 있다.
            assertThat(s.findDetail("ctx-" + (SlowCallSampler.DETAIL_CAPACITY + 4))).isPresent();
        }

        @Test
        void recordDetail_overwritesExistingContextId() {
            SlowCallSampler s = new SlowCallSampler();
            s.recordDetail("ask", "t", 10, "ctx-x", "q1", "a1", List.of(), 1, 1, "m1");
            s.recordDetail("ask", "t", 20, "ctx-x", "q2", "a2", List.of(), 2, 2, "m2");
            SlowCallSampler.Detail d = s.findDetail("ctx-x").orElseThrow();
            assertThat(d.answer()).isEqualTo("a2");
            assertThat(d.modelId()).isEqualTo("m2");
            assertThat(d.latencyMs()).isEqualTo(20);
        }

        @Test
        void findDetail_incrementsHitAndMissCounters() {
            SimpleMeterRegistry meters = new SimpleMeterRegistry();
            SlowCallSampler s = new SlowCallSampler(meters);
            s.recordDetail("ask", "t", 10, "ctx-known", "q", "a", List.of(), 0, 0, "m");

            // hit
            assertThat(s.findDetail("ctx-known")).isPresent();
            assertThat(s.findDetail("ctx-known")).isPresent();
            // miss
            assertThat(s.findDetail("ctx-unknown")).isEmpty();
            // blank/null은 계측 대상 아님 (컨트롤러로 들어오지 않는 비정상 입력)
            assertThat(s.findDetail("")).isEmpty();
            assertThat(s.findDetail(null)).isEmpty();

            assertThat(meters.counter("knowledge.ai.slow.detail.lookup", "result", "hit").count())
                    .isEqualTo(2.0);
            assertThat(meters.counter("knowledge.ai.slow.detail.lookup", "result", "miss").count())
                    .isEqualTo(1.0);
        }
    }
}
