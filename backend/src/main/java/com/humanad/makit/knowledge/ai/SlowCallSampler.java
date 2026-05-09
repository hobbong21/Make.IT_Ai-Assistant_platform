package com.humanad.makit.knowledge.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 최근 ask/action 호출 메타를 (kind, tag) 별 ring buffer로 보관해
 * "이 컬렉션·액션이 왜 느린가?"를 진단할 수 있도록 한다.
 *
 * <p>샘플 메타 저장 백엔드는 Redis List ({@code makit:ai:slow:{kind}:{tag}}) —
 * 인스턴스를 가로질러 같은 표본을 보고, 백엔드 재시작·스케일아웃 후에도 최근 호출을
 * 잃지 않는다. 키마다 {@link #CAPACITY}건만 유지되도록 매 기록 후 {@code LTRIM}
 * 하고, {@link #TTL} 동안만 보관해 무한 누적을 막는다. Redis 가용성에 따라 동작:
 * <ul>
 *   <li>Redis 사용 가능: List에 LPUSH → LTRIM → EXPIRE. 읽기는 LRANGE.</li>
 *   <li>Redis 미설정/오류: JVM 인메모리 fallback (ConcurrentLinkedDeque).
 *       단위 테스트 및 Redis 없이 부팅된 환경에서 회귀를 피하기 위함.</li>
 * </ul>
 *
 * <p>관리자 대시보드의 {@code aiq-tag-row--over} 행 클릭 시
 * {@link com.humanad.makit.admin.AiQualityController#slow}가 이 버퍼를 조회한다.
 *
 * <p>샘플 모달에서 contextId를 클릭하면 해당 호출의 답변/인용/토큰까지 한 화면에서
 * 확인할 수 있도록, 메타와 별도로 contextId 키 LRU 맵에 응답 본문을
 * {@link Detail}로 보관한다 ({@link #DETAIL_CAPACITY}건). 메모리 보호를 위해
 * 답변/인용 발췌도 길이 상한을 둔다. Detail 저장은 현재 인스턴스 로컬(JVM 메모리)
 * 이며, 다중 인스턴스/재시작 후 일치는 보장하지 않는다 — Sample 메타와는 별도로
 * 트레이드오프(빠른 조회 vs. 영속성)를 둔 것.
 */
@Slf4j
@Component
public class SlowCallSampler {

    /** 태그당 보관할 최대 샘플 수. 모달 상위 N건 노출용으로 충분한 여유. */
    static final int CAPACITY = 20;
    /** 질문/제목 본문 최대 길이. 너무 긴 프롬프트가 응답에 실리지 않도록 잘라낸다. */
    static final int MAX_QUESTION = 200;
    /** contextId 별 응답 본문 보관 상한. 가장 오래된 항목부터 LRU로 밀려난다. */
    static final int DETAIL_CAPACITY = 200;
    /** 응답 본문 최대 길이. 모달이 거대한 출력으로 부풀지 않도록 잘라낸다. */
    static final int MAX_ANSWER = 8_000;
    /** 인용 1건의 snippet 최대 길이. */
    static final int MAX_SNIPPET = 400;
    /** 보관할 인용 최대 개수. */
    static final int MAX_CITATIONS = 20;
    /** Redis 키 보관 기간. 운영 회고는 며칠 단위면 충분, 무한 누적 방지. */
    static final Duration TTL = Duration.ofDays(7);

    private static final String KEY_PREFIX = "makit:ai:slow:";

    public record Sample(
            String kind,
            String tag,
            long latencyMs,
            String contextId,
            String question,
            String modelId,
            Instant ts) {}

    /** contextId로 조회하는 응답 본문 상세. 답변/인용/토큰을 한 번에 노출한다. */
    public record Detail(
            String contextId,
            String kind,
            String tag,
            long latencyMs,
            String question,
            String answer,
            List<Citation> citations,
            int tokensIn,
            int tokensOut,
            String modelId,
            Instant ts) {}

    public record Citation(
            String documentId,
            String title,
            int chunkIndex,
            double score,
            String snippet) {}

    private final StringRedisTemplate redis; // null이면 인메모리 모드
    private final ObjectMapper mapper;
    /** Redis 미사용/오류 시 fallback 버퍼 — 기존 동작과 호환. */
    private final Map<String, Deque<Sample>> buffers = new ConcurrentHashMap<>();

    /**
     * contextId → Detail. 접근 순서 LRU(linked-hash-map access-order)로 가장 오래된
     * 항목부터 밀려난다. 동시 접근은 외부 동기화로 보호한다 (LinkedHashMap은 thread-safe X).
     */
    private final Map<String, Detail> details = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Detail> eldest) {
                    return size() > DETAIL_CAPACITY;
                }
            });

    /**
     * 응답 본문 LRU의 적중/만료를 추적하는 마이크로미터 카운터.
     * 만료 비율이 높으면 {@link #DETAIL_CAPACITY}를 키우거나 영구 저장으로 옮길지
     * 판단할 수 있도록 운영 대시보드에서 노출한다.
     */
    private final Counter detailHitCounter;
    private final Counter detailMissCounter;

    /**
     * 운영용 생성자. Redis가 없는 환경(예: 단위 테스트 컨텍스트)에서도 안전하도록
     * Redis/ObjectMapper 의존성은 {@link ObjectProvider}로 받아 missing 시 null로
     * 떨어지고, MeterRegistry는 Spring Boot Actuator가 항상 제공한다.
     */
    @Autowired
    public SlowCallSampler(ObjectProvider<StringRedisTemplate> redisProvider,
                           ObjectProvider<ObjectMapper> mapperProvider,
                           MeterRegistry meters) {
        this(redisProvider.getIfAvailable(), mapperProvider.getIfAvailable(), meters);
    }

    /** 테스트/주입 직접 제어용. */
    public SlowCallSampler(StringRedisTemplate redis, ObjectMapper mapper, MeterRegistry meters) {
        this.redis = redis;
        this.mapper = mapper != null ? mapper : defaultMapper();
        MeterRegistry mr = meters != null ? meters : new SimpleMeterRegistry();
        this.detailHitCounter = Counter.builder("knowledge.ai.slow.detail.lookup")
                .description("느린 샘플 모달에서 contextId로 응답 본문을 조회한 결과 (hit=보관 중, miss=LRU 만료/미보관)")
                .tag("result", "hit")
                .register(mr);
        this.detailMissCounter = Counter.builder("knowledge.ai.slow.detail.lookup")
                .description("느린 샘플 모달에서 contextId로 응답 본문을 조회한 결과 (hit=보관 중, miss=LRU 만료/미보관)")
                .tag("result", "miss")
                .register(mr);
    }

    /** 테스트 호환 생성자: Redis만 직접 제어, 메트릭은 임베드된 SimpleMeterRegistry. */
    public SlowCallSampler(StringRedisTemplate redis, ObjectMapper mapper) {
        this(redis, mapper, new SimpleMeterRegistry());
    }

    /** 메트릭만 직접 제어하는 in-memory 전용 생성자. */
    public SlowCallSampler(MeterRegistry meters) {
        this(null, null, meters);
    }

    /** Redis 없이 동작하는 in-memory 전용 생성자 (기존 호출자/테스트 호환). */
    public SlowCallSampler() {
        this(null, null, new SimpleMeterRegistry());
    }

    public void record(String kind,
                       String tag,
                       long latencyMs,
                       String contextId,
                       String question,
                       String modelId) {
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        Sample s = new Sample(kind, safeTag, Math.max(0, latencyMs),
                contextId == null ? "" : contextId,
                truncate(question, MAX_QUESTION),
                modelId == null ? "" : modelId,
                Instant.now());

        if (redis != null) {
            String key = redisKey(kind, safeTag);
            try {
                String json = mapper.writeValueAsString(s);
                redis.opsForList().leftPush(key, json);
                // CAPACITY 초과 분 절단. LTRIM start..end는 inclusive.
                redis.opsForList().trim(key, 0, CAPACITY - 1);
                redis.expire(key, TTL);
                return;
            } catch (Exception e) {
                log.warn("SlowCallSampler redis write failed, falling back to in-memory: {}",
                        e.toString());
            }
        }

        Deque<Sample> q = buffers.computeIfAbsent(memKey(kind, safeTag),
                k -> new ConcurrentLinkedDeque<>());
        q.addFirst(s);
        // 헤드에 누적되므로 꼬리에서 잘라내 가장 오래된 샘플을 제거한다.
        while (q.size() > CAPACITY) q.pollLast();
    }

    /**
     * contextId로 조회 가능한 응답 본문(답변/인용/토큰)을 LRU에 보관한다.
     * 동일 contextId가 다시 들어오면(스트림 vs 비스트림 둘 다 호출되는 등) 최신 값으로 덮어쓴다.
     */
    public void recordDetail(String kind,
                             String tag,
                             long latencyMs,
                             String contextId,
                             String question,
                             String answer,
                             List<Citation> citations,
                             int tokensIn,
                             int tokensOut,
                             String modelId) {
        if (contextId == null || contextId.isBlank()) return;
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        List<Citation> safeCits = sanitizeCitations(citations);
        Detail d = new Detail(
                contextId,
                kind,
                safeTag,
                Math.max(0, latencyMs),
                truncate(question, MAX_QUESTION),
                truncate(answer, MAX_ANSWER),
                safeCits,
                Math.max(0, tokensIn),
                Math.max(0, tokensOut),
                modelId == null ? "" : modelId,
                Instant.now());
        details.put(contextId, d);
    }

    public Optional<Detail> findDetail(String contextId) {
        if (contextId == null || contextId.isBlank()) return Optional.empty();
        Detail d = details.get(contextId);
        if (d == null) {
            detailMissCounter.increment();
            return Optional.empty();
        }
        detailHitCounter.increment();
        return Optional.of(d);
    }

    /**
     * 지정 (kind, tag) 짝의 샘플 ring buffer와 그에 속하는 contextId Detail을
     * 모두 비운다. 운영자가 잘못된/오래된 호출 표본을 즉시 정리할 수 있도록
     * 관리자 화면의 "비우기" 동작이 호출한다.
     *
     * <p>Redis-backed 모드에서는 List 키({@code makit:ai:slow:{kind}:{tag}})를
     * {@code DEL}로 제거한다. in-memory fallback 버퍼도 함께 비워, 두 모드를
     * 혼용한 환경(Redis 일시 장애 후 fallback 누적)에서도 잔존 표본이 없도록 한다.
     * Detail LRU에서는 비워진 (kind, tag)에 매칭되는 항목만 골라 제거한다.
     *
     * @return 제거된 항목 수(샘플 + Detail 합계, 보고/감사 로그용 근사치).
     */
    public int clear(String kind, String tag) {
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        int removed = 0;

        if (redis != null) {
            String key = redisKey(kind, safeTag);
            try {
                Long len = redis.opsForList().size(key);
                Boolean del = redis.delete(key);
                if (Boolean.TRUE.equals(del) && len != null) removed += len.intValue();
            } catch (Exception e) {
                log.warn("SlowCallSampler redis clear failed, continuing with in-memory clear: {}",
                        e.toString());
            }
        }

        Deque<Sample> q = buffers.remove(memKey(kind, safeTag));
        if (q != null) removed += q.size();

        // Detail은 contextId 키 LRU라 (kind, tag)로 직접 인덱싱돼 있지 않다.
        // 같은 태그의 항목을 골라 제거 — DETAIL_CAPACITY가 작아 선형 스캔 비용은 무시 가능.
        synchronized (details) {
            int before = details.size();
            details.entrySet().removeIf(e -> {
                Detail d = e.getValue();
                return d != null
                        && java.util.Objects.equals(d.kind(), kind)
                        && java.util.Objects.equals(d.tag(), safeTag);
            });
            removed += before - details.size();
        }
        return removed;
    }

    /**
     * 가장 최근 호출부터 latencyMs 내림차순으로 정렬해 상위 {@code limit}건 반환.
     * "느린 호출"이 위로 오도록 정렬해 진단 흐름을 단축한다.
     */
    public List<Sample> recent(String kind, String tag, int limit) {
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        List<Sample> all = new ArrayList<>();
        boolean redisOk = false;

        if (redis != null) {
            String key = redisKey(kind, safeTag);
            try {
                List<String> raw = redis.opsForList().range(key, 0, -1);
                redisOk = true;
                if (raw != null) {
                    for (String j : raw) {
                        try {
                            all.add(mapper.readValue(j, Sample.class));
                        } catch (Exception ignore) {
                            // 한 항목이 깨져도 나머지는 살린다.
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("SlowCallSampler redis read failed, falling back to in-memory: {}",
                        e.toString());
            }
        }

        // Redis가 정상 응답했다면 그 결과(빈 결과 포함)를 신뢰한다. 그렇지 않을 때만
        // in-memory fallback을 합쳐 진단을 끊기지 않게 한다.
        if (!redisOk) {
            Deque<Sample> q = buffers.get(memKey(kind, safeTag));
            if (q != null) all.addAll(q);
        }

        if (all.isEmpty()) return List.of();
        all.sort((a, b) -> Long.compare(b.latencyMs(), a.latencyMs()));
        int n = Math.min(Math.max(1, limit), all.size());
        return all.subList(0, n);
    }

    private static String redisKey(String kind, String tag) {
        return KEY_PREFIX + memKey(kind, tag);
    }

    private static String memKey(String kind, String tag) {
        return (kind == null ? "" : kind) + ":" + tag;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() <= max ? t : t.substring(0, max) + "...";
    }

    private static List<Citation> sanitizeCitations(List<Citation> in) {
        if (in == null || in.isEmpty()) return List.of();
        int n = Math.min(in.size(), MAX_CITATIONS);
        List<Citation> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            Citation c = in.get(i);
            if (c == null) continue;
            out.add(new Citation(
                    c.documentId() == null ? "" : c.documentId(),
                    c.title() == null ? "" : c.title(),
                    c.chunkIndex(),
                    c.score(),
                    truncate(c.snippet(), MAX_SNIPPET)));
        }
        return out;
    }

    private static ObjectMapper defaultMapper() {
        ObjectMapper m = new ObjectMapper();
        m.registerModule(new JavaTimeModule());
        return m;
    }
}
