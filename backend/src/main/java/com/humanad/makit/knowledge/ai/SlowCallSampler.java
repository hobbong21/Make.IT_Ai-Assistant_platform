package com.humanad.makit.knowledge.ai;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
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
 */
@Component
public class SlowCallSampler {

    /** 태그당 보관할 최대 샘플 수. 모달 상위 N건 노출용으로 충분한 여유. */
    static final int CAPACITY = 20;
    /** 질문/제목 본문 최대 길이. 너무 긴 프롬프트가 응답에 실리지 않도록 잘라낸다. */
    static final int MAX_QUESTION = 200;

    public record Sample(
            String kind,
            String tag,
            long latencyMs,
            String contextId,
            String question,
            String modelId,
            Instant ts) {}

    private final Map<String, Deque<Sample>> buffers = new ConcurrentHashMap<>();

    public void record(String kind,
                       String tag,
                       long latencyMs,
                       String contextId,
                       String question,
                       String modelId) {
        String safeTag = (tag == null || tag.isBlank()) ? "all" : tag;
        Sample s = new Sample(kind, safeTag, Math.max(0, latencyMs),
                contextId == null ? "" : contextId,
                truncate(question),
                modelId == null ? "" : modelId,
                Instant.now());
        Deque<Sample> q = buffers.computeIfAbsent(key(kind, safeTag),
                k -> new ConcurrentLinkedDeque<>());
        q.addFirst(s);
        // 헤드에 누적되므로 꼬리에서 잘라내 가장 오래된 샘플을 제거한다.
        while (q.size() > CAPACITY) q.pollLast();
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

    private static String truncate(String s) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() <= MAX_QUESTION ? t : t.substring(0, MAX_QUESTION) + "...";
    }
}
