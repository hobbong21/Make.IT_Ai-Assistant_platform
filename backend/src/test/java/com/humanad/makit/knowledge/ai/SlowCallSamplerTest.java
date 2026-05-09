package com.humanad.makit.knowledge.ai;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Focused tests for {@link SlowCallSampler}'s contextId-keyed detail store
 * (느린 샘플 모달의 contextId 클릭 시 답변/인용/토큰을 보여주는 기능 지원).
 *
 * <p>Sample ring buffer 동작은 컨트롤러/서비스 통합 테스트가 커버하므로 여기서는
 * {@code recordDetail / findDetail} 의 LRU 동작과 입력 정규화만 좁게 검증한다.
 */
class SlowCallSamplerTest {

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
}
