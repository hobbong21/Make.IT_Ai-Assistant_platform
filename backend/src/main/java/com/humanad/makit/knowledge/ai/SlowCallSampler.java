package com.humanad.makit.knowledge.ai;

import org.springframework.stereotype.Component;

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
 * "이 컬렉션·액션이 왜 느린가?"를 진단할 수 있도록 한다. JVM 메모리에만 저장하며,
 * 재시작 시 사라진다. 정확한 추적이 필요하면 별도 로그/스팬을 사용해야 한다.
 *
 * <p>관리자 대시보드의 {@code aiq-tag-row--over} 행 클릭 시
 * {@link com.humanad.makit.admin.AiQualityController#slow}가 이 버퍼를 조회한다.
 *
 * <p>버퍼 크기는 태그당 {@link #CAPACITY}건. 한 태그가 과도하게 호출되더라도 다른 태그
 * 샘플을 잃지 않도록 태그별로 분리해 보관한다.
 *
 * <p>샘플 모달에서 contextId를 클릭하면 해당 호출의 답변/인용/토큰까지 한 화면에서
 * 확인할 수 있도록, 메타와 별도로 contextId 키 LRU 맵에 응답 본문을
 * {@link Detail}로 보관한다 ({@link #DETAIL_CAPACITY}건). 메모리 보호를 위해
 * 답변/인용 발췌도 길이 상한을 둔다.
 */
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
        Deque<Sample> q = buffers.computeIfAbsent(key(kind, safeTag),
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
        return Optional.ofNullable(details.get(contextId));
    }

    /**
     * 가장 최근 호출부터 latencyMs 내림차순으로 정렬해 상위 {@code limit}건 반환.
     * "느린 호출"이 위로 오도록 정렬해 진단 흐름을 단축한다.
     */
    public List<Sample> recent(String kind, String tag, int limit) {
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        Deque<Sample> q = buffers.get(key(kind, safeTag));
        if (q == null || q.isEmpty()) return List.of();
        List<Sample> all = new ArrayList<>(q);
        all.sort((a, b) -> Long.compare(b.latencyMs(), a.latencyMs()));
        int n = Math.min(Math.max(1, limit), all.size());
        return all.subList(0, n);
    }

    private static String key(String kind, String tag) {
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
}
