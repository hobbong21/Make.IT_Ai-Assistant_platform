package com.humanad.makit.admin;

import com.humanad.makit.knowledge.ai.OfficeHubFeedback;
import com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepository;
import com.humanad.makit.knowledge.ai.SlowCallSampler;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 단위 테스트: {@link AiQualityController#quality}.
 *
 * <p>{@link SimpleMeterRegistry}에 태그가 다른 가짜 Timer를 직접 등록한 뒤,
 * 응답 DTO의 {@code askByCollection}/{@code actionByAction} 정렬(p95 내림차순)과
 * 값(태그 식별/카운트)이 기대대로 노출되는지, {@code latency.p95ThresholdMs}와
 * 행별 {@code p95ThresholdMs}가 yml 오버라이드 / 전역 기본값 규칙대로 채워지는지를
 * 검증한다. 회귀 시 컨트롤러 응답 형태 변경을 즉시 알아차리기 위함.
 */
@ExtendWith(MockitoExtension.class)
class AiQualityControllerTest {

    @Mock OfficeHubFeedbackRepository feedbackRepo;
    @Mock AiQualityThresholdsService thresholdsService;
    @Mock SlowCallSampler slowSampler;

    private MeterRegistry meters;
    private AiQualityProperties props;
    private AiQualityController controller;

    @BeforeEach
    void setUp() {
        meters = new SimpleMeterRegistry();
        props = new AiQualityProperties();
        controller = new AiQualityController(feedbackRepo, meters, thresholdsService, slowSampler, props);

        // 기본 유효 임계치: AiQualityProperties yml 기본값 그대로 노출.
        // lenient() — slowDetailFeedback 테스트는 thresholdsService를 호출하지
        // 않으므로 strict stubbing 위반을 막기 위해 느슨하게 등록한다.
        lenient().when(thresholdsService.current()).thenReturn(new AiQualityThresholdsService.EffectiveThresholds(
                props.getHelpfulRateThreshold(),
                props.getLatencyMeanAlertMs(),
                props.getLatencyP95AlertMs(),
                props.getMinSamplesForRateAlert(),
                null, null, null, "DEFAULTS"));

        // 피드백 레포는 모두 빈 결과 → 컨트롤러는 메트릭 부분 검증에 집중.
        // 마찬가지로 quality() 전용 스텁이라 slowDetailFeedback 테스트에서는 lenient.
        lenient().when(feedbackRepo.aggregateDaily(any())).thenReturn(List.of());
        lenient().when(feedbackRepo.aggregateByAction(any())).thenReturn(List.of());
        lenient().when(feedbackRepo.topDocuments(any(), any(Pageable.class))).thenReturn(List.of());

        // ---- knowledge.ai.ask.latency: collection=a (빠름), b (느림) -----------
        Timer askA = Timer.builder("knowledge.ai.ask.latency")
                .tag("collection", "a")
                .publishPercentiles(0.5, 0.95)
                .register(meters);
        for (int i = 0; i < 5; i++) askA.record(Duration.ofMillis(100));

        Timer askB = Timer.builder("knowledge.ai.ask.latency")
                .tag("collection", "b")
                .publishPercentiles(0.5, 0.95)
                .register(meters);
        for (int i = 0; i < 3; i++) askB.record(Duration.ofMillis(500));

        // ---- knowledge.ai.action.latency: action=summarize (빠름), translate (느림)
        Timer actSum = Timer.builder("knowledge.ai.action.latency")
                .tag("action", "summarize")
                .publishPercentiles(0.5, 0.95)
                .register(meters);
        for (int i = 0; i < 4; i++) actSum.record(Duration.ofMillis(50));

        Timer actTr = Timer.builder("knowledge.ai.action.latency")
                .tag("action", "translate")
                .publishPercentiles(0.5, 0.95)
                .register(meters);
        for (int i = 0; i < 2; i++) actTr.record(Duration.ofMillis(300));
    }

    @Test
    void quality_exposesPerTagLatency_sortedByP95Desc() {
        AiQualityDto dto = controller.quality(7, 10);

        // askByCollection: 느린 b가 먼저, 빠른 a가 뒤. 태그 식별/카운트 정확.
        List<AiQualityDto.TagLatency> ask = dto.latency().askByCollection();
        assertThat(ask).extracting(AiQualityDto.TagLatency::tag)
                .containsExactly("b", "a");
        assertThat(ask).extracting(AiQualityDto.TagLatency::count)
                .containsExactly(3L, 5L);
        assertThat(ask.get(0).p95Ms()).isGreaterThanOrEqualTo(ask.get(1).p95Ms());
        // 평균(ms): 기록한 값과 일치 (각 샘플이 동일 길이라 mean == 그 값).
        assertThat(ask.get(0).meanMs()).isEqualTo(500.0);
        assertThat(ask.get(1).meanMs()).isEqualTo(100.0);

        // actionByAction: translate(느림) 먼저, summarize(빠름) 뒤.
        List<AiQualityDto.TagLatency> act = dto.latency().actionByAction();
        assertThat(act).extracting(AiQualityDto.TagLatency::tag)
                .containsExactly("translate", "summarize");
        assertThat(act).extracting(AiQualityDto.TagLatency::count)
                .containsExactly(2L, 4L);
        assertThat(act.get(0).meanMs()).isEqualTo(300.0);
        assertThat(act.get(1).meanMs()).isEqualTo(50.0);
    }

    @Test
    void quality_exposesP95ThresholdMsFromEffectiveThresholds() {
        // 운영 임계와 응답 노출 임계가 동일한 값을 쓰는지 확인 (기본값).
        AiQualityDto dto = controller.quality(7, 10);
        assertThat(dto.latency().p95ThresholdMs())
                .isEqualTo(props.getLatencyP95AlertMs());

        // DB 오버라이드(=EffectiveThresholds)가 그대로 반영되는지도 확인.
        when(thresholdsService.current()).thenReturn(new AiQualityThresholdsService.EffectiveThresholds(
                props.getHelpfulRateThreshold(),
                props.getLatencyMeanAlertMs(),
                12_345.0,
                props.getMinSamplesForRateAlert(),
                null, null, null, "DB"));
        AiQualityDto dto2 = controller.quality(7, 10);
        assertThat(dto2.latency().p95ThresholdMs()).isEqualTo(12_345.0);
        assertThat(dto2.thresholds().latencyP95AlertMs()).isEqualTo(12_345.0);
    }

    @Test
    void quality_globalAskCountSumsAcrossTags() {
        AiQualityDto dto = controller.quality(7, 10);
        // 전역 askCount는 모든 태그 합 (5 + 3).
        assertThat(dto.latency().askCount()).isEqualTo(8L);
        // 전역 actionCount는 4 + 2.
        assertThat(dto.latency().actionCount()).isEqualTo(6L);
    }

    @Test
    void quality_appliesPerCollectionAndPerActionP95Overrides() {
        // 컬렉션 b는 자체 임계치 200ms, 액션 translate는 자체 임계치 1000ms.
        // 미설정 키(a, summarize)는 전역 기본값 fallback.
        props.setAskP95AlertMsByCollection(Map.of("b", 200.0));
        props.setActionP95AlertMsByAction(Map.of("translate", 1000.0));

        AiQualityDto dto = controller.quality(7, 10);

        // 행별 임계치가 오버라이드/전역 fallback 규칙대로 채워짐.
        Map<String, Double> askThresholdByTag = dto.latency().askByCollection().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AiQualityDto.TagLatency::tag, AiQualityDto.TagLatency::p95ThresholdMs));
        assertThat(askThresholdByTag).containsEntry("b", 200.0);
        assertThat(askThresholdByTag).containsEntry("a", props.getLatencyP95AlertMs());

        Map<String, Double> actThresholdByTag = dto.latency().actionByAction().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AiQualityDto.TagLatency::tag, AiQualityDto.TagLatency::p95ThresholdMs));
        assertThat(actThresholdByTag).containsEntry("translate", 1000.0);
        assertThat(actThresholdByTag).containsEntry("summarize", props.getLatencyP95AlertMs());

        // b는 p95(=500ms) > 200ms → 태그 단위 알림이 추가되어야 한다.
        // translate는 p95(=300ms) <= 1000ms → 알림 없음.
        // a, summarize는 전역 기본값(10000ms) 미만이므로 알림 없음.
        assertThat(dto.alerts()).anyMatch(s -> s.contains("'b'") && s.contains("p95"));
        assertThat(dto.alerts()).noneMatch(s -> s.contains("'translate'"));
        assertThat(dto.alerts()).noneMatch(s -> s.contains("'a'"));
        assertThat(dto.alerts()).noneMatch(s -> s.contains("'summarize'"));

        // Thresholds DTO에도 오버라이드 표가 노출된다.
        assertThat(dto.thresholds().askP95AlertMsByCollection()).containsEntry("b", 200.0);
        assertThat(dto.thresholds().actionP95AlertMsByAction()).containsEntry("translate", 1000.0);
    }

    // ---------------------------------------------------------------- slowDetailFeedback
    // GET /api/admin/ai/slow/detail/feedback — 느린 호출 모달 하단의 helpful/notHelpful
    // 카운트와 최근 코멘트(최대 3건)를 만든다. 카운트가 어긋나면 운영자가 잘못된
    // 우선순위로 작업하므로, 회귀를 막기 위한 단위 테스트.

    private static OfficeHubFeedback fb(boolean helpful, String action,
                                        String comment, OffsetDateTime createdAt) {
        OfficeHubFeedback f = new OfficeHubFeedback();
        f.setContextId("ctx-1");
        f.setHelpful(helpful);
        f.setAction(action);
        f.setComment(comment);
        f.setCreatedAt(createdAt);
        return f;
    }

    @Test
    void slowDetailFeedback_zeroFeedback_returnsZerosAndEmptyComments() {
        // 카운트 행 자체가 비어 있을 때 (= 매칭 행 없음) 0/0/[]을 돌려준다.
        when(feedbackRepo.countByContextId("ctx-1")).thenReturn(List.of());
        when(feedbackRepo.findByContextId(eq("ctx-1"), any(Pageable.class))).thenReturn(List.of());

        var summary = controller.slowDetailFeedback("ctx-1");

        assertThat(summary.helpful()).isZero();
        assertThat(summary.notHelpful()).isZero();
        assertThat(summary.recentComments()).isEmpty();
    }

    @Test
    void slowDetailFeedback_nullSumRow_isTreatedAsZero() {
        // SUM(...)은 매칭 행이 없으면 NULL을 반환 — 컨트롤러가 NULL 가드를 해야 한다.
        when(feedbackRepo.countByContextId("ctx-1"))
                .thenReturn(List.of(new Object[]{null, null}));
        when(feedbackRepo.findByContextId(eq("ctx-1"), any(Pageable.class))).thenReturn(List.of());

        var summary = controller.slowDetailFeedback("ctx-1");

        assertThat(summary.helpful()).isZero();
        assertThat(summary.notHelpful()).isZero();
        assertThat(summary.recentComments()).isEmpty();
    }

    @Test
    void slowDetailFeedback_mixedFeedback_countsAccurately_andLimitsToThreeNewest() {
        // 혼합 피드백: helpful=2, notHelpful=3. 레포 카운트가 그대로 노출돼야 함.
        when(feedbackRepo.countByContextId("ctx-1"))
                .thenReturn(List.of(new Object[]{2L, 3L}));

        // findByContextId는 이미 ORDER BY createdAt DESC + Pageable(size=3)로 조회되므로
        // 레포가 돌려준 순서가 곧 응답 순서다. 컨트롤러가 PageRequest.of(0, 3)를
        // 쓰는지 검증하기 위해 5건을 돌려줘도 컨트롤러는 받은 만큼만 매핑한다.
        OffsetDateTime t0 = OffsetDateTime.of(2026, 5, 1, 0, 0, 0, 0, ZoneOffset.UTC);
        when(feedbackRepo.findByContextId(eq("ctx-1"), any(Pageable.class))).thenReturn(List.of(
                fb(false, "ask", "newest",  t0.plusMinutes(5)),
                fb(true,  "ask", "middle",  t0.plusMinutes(3)),
                fb(false, "ask", "oldest",  t0.plusMinutes(1))
        ));

        var summary = controller.slowDetailFeedback("ctx-1");

        assertThat(summary.helpful()).isEqualTo(2L);
        assertThat(summary.notHelpful()).isEqualTo(3L);
        // 최신순 + 최대 3건. 레포가 size=3으로 제한해 돌려준 그대로 매핑.
        assertThat(summary.recentComments()).extracting(c -> c.comment())
                .containsExactly("newest", "middle", "oldest");
        assertThat(summary.recentComments().get(0).helpful()).isFalse();
        assertThat(summary.recentComments().get(1).helpful()).isTrue();

        // 컨트롤러가 Pageable로 size=3을 넘기는지 확인 (운영자 화면 사양).
        org.mockito.ArgumentCaptor<Pageable> page = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(feedbackRepo).findByContextId(eq("ctx-1"), page.capture());
        assertThat(page.getValue().getPageSize()).isEqualTo(3);
        assertThat(page.getValue().getPageNumber()).isZero();
    }

    @Test
    void slowDetailFeedback_blankContextId_returnsEmptySummaryWithoutHittingRepo() {
        var empty   = controller.slowDetailFeedback("");
        var spaces  = controller.slowDetailFeedback("   ");
        var nullCtx = controller.slowDetailFeedback(null);

        for (var s : List.of(empty, spaces, nullCtx)) {
            assertThat(s.helpful()).isZero();
            assertThat(s.notHelpful()).isZero();
            assertThat(s.recentComments()).isEmpty();
        }
        // 빈 contextId면 DB를 건드리지 않는다 — 잘못된 매스 쿼리 방지.
        verify(feedbackRepo, never()).countByContextId(any());
        verify(feedbackRepo, never()).findByContextId(any(), any(Pageable.class));
    }
}
