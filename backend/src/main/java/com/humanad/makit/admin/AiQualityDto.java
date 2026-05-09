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
        List<String> alerts
) {
    public record DailyPoint(String date, long helpful, long notHelpful) {}
    public record ActionStat(String action, long helpful, long notHelpful, double helpfulRate) {}
    public record DocStat(String documentId, long count) {}
    public record Latency(
            double askMeanMs, double askP50Ms, double askP95Ms, long askCount,
            double actionMeanMs, double actionP50Ms, double actionP95Ms, long actionCount) {}
}
