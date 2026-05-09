package com.humanad.makit.admin;

import java.util.List;

/**
 * AI 답변 품질 대시보드 응답 DTO. {@link AiQualityController#quality} 가 반환.
 *
 * <p>모든 비율값은 0.0~1.0 범위의 실수. 차트 렌더링/임계 비교 모두 프런트에서 처리.
 */
public record AiQualityDto(
        int windowDays,
        long totalFeedback,
        double helpfulRate,
        double helpfulRateThreshold,
        List<DailyPoint> daily,
        List<ActionStat> byAction,
        List<DocStat> topDocuments,
        Latency latency,
        List<String> alerts,
        Thresholds thresholds
) {
    public record DailyPoint(String date, long helpful, long notHelpful) {}
    public record ActionStat(String action, long helpful, long notHelpful, double helpfulRate) {}
    public record DocStat(String documentId, long count) {}

    /**
     * 응답 시간 메트릭 요약. {@code askByCollection}/{@code actionByAction}는 태그별
     * 분포를 그대로 노출해, 어느 컬렉션·액션이 꼬리 지연을 유발하는지 식별하기 위한 표 데이터.
     * 전역 mean/p50/p95는 기존 호환을 위해 유지(태그 중 최댓값 = 가장 느린 태그).
     * {@code p95ThresholdMs}는 프런트의 강조 임계와 백엔드 경고 임계가 어긋나지 않도록
     * 운영 임계({@link Thresholds#latencyP95AlertMs})와 동일한 값을 그대로 노출한다.
     */
    public record Latency(
            double askMeanMs, double askP50Ms, double askP95Ms, long askCount,
            double actionMeanMs, double actionP50Ms, double actionP95Ms, long actionCount,
            double p95ThresholdMs,
            List<TagLatency> askByCollection,
            List<TagLatency> actionByAction) {}

    /** 태그(컬렉션 또는 액션) 한 건의 응답 시간 통계. */
    public record TagLatency(String tag, double meanMs, double p50Ms, double p95Ms, long count) {}

    /**
     * 현재 적용 중인 운영 임계치. 프런트는 이 값으로 경고 배너/배지를 동기화한다.
     * {@code makit.ai.quality.*}로 외부화돼 있어 재배포 없이 조정 가능.
     */
    public record Thresholds(
            double helpfulRateThreshold,
            double latencyMeanAlertMs,
            double latencyP95AlertMs,
            long minSamplesForRateAlert) {}
}
