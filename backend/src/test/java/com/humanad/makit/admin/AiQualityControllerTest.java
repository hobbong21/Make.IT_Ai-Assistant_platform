package com.humanad.makit.admin;

import com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepository;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * 단위 테스트: {@link AiQualityController#quality}.
 *
 * <p>{@link SimpleMeterRegistry}에 태그가 다른 가짜 Timer를 직접 등록한 뒤,
 * 응답 DTO의 {@code askByCollection}/{@code actionByAction} 정렬(p95 내림차순)과
 * 값(태그 식별/카운트)이 기대대로 노출되는지, {@code latency.p95ThresholdMs}가
 * {@link AiQualityProperties#getLatencyP95AlertMs()}와 동일하게 노출되는지를
 * 검증한다. 회귀 시 컨트롤러 응답 형태 변경을 즉시 알아차리기 위함.
 */
@ExtendWith(MockitoExtension.class)
class AiQualityControllerTest {

    @Mock OfficeHubFeedbackRepository feedbackRepo;

    private MeterRegistry meters;
    private AiQualityProperties props;
    private AiQualityController controller;

    @BeforeEach
    void setUp() {
        meters = new SimpleMeterRegistry();
        props = new AiQualityProperties();
        controller = new AiQualityController(feedbackRepo, meters, props);

        // 피드백 레포는 모두 빈 결과 → 컨트롤러는 메트릭 부분 검증에 집중.
        when(feedbackRepo.aggregateDaily(any())).thenReturn(List.of());
        when(feedbackRepo.aggregateByAction(any())).thenReturn(List.of());
        when(feedbackRepo.topDocuments(any(), any(Pageable.class))).thenReturn(List.of());

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
    void quality_exposesP95ThresholdMsFromProperties() {
        // 운영 임계와 응답 노출 임계가 동일한 값을 쓰는지 확인 (기본값).
        AiQualityDto dto = controller.quality(7, 10);
        assertThat(dto.latency().p95ThresholdMs())
                .isEqualTo(props.getLatencyP95AlertMs());

        // 임계 변경이 그대로 반영되는지도 확인.
        props.setLatencyP95AlertMs(12_345.0);
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
}
