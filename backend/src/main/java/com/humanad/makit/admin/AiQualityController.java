package com.humanad.makit.admin;

import com.humanad.makit.knowledge.CurrentUser;
import com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepository;
import com.humanad.makit.knowledge.ai.SlowCallSampler;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.ToDoubleFunction;

/**
 * 관리자 전용 AI 답변 품질 대시보드.
 *
 * <p>{@code office_hub_ai_feedback} 테이블과 {@code knowledge.ai.*} 마이크로미터
 * 메트릭을 합쳐 최근 N일의 추세를 한 번의 호출로 돌려준다. 차트/배너 렌더링은
 * 프런트({@code frontend/js/pages/admin.js})에서 담당.
 */
@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
@Tag(name = "admin")
public class AiQualityController {

    private final OfficeHubFeedbackRepository feedbackRepo;
    private final MeterRegistry meters;
    private final AiQualityThresholdsService thresholdsService;
    private final SlowCallSampler slowSampler;
    /**
     * yml/env에 선언된 컬렉션·액션별 p95 오버라이드 표를 읽기 위한 정적 설정.
     * 전역 helpful/mean/p95 기본값은 {@link AiQualityThresholdsService}가 DB
     * 오버라이드를 포함해 노출하므로 그쪽을 사용한다.
     */
    private final AiQualityProperties properties;

    @Operation(summary = "AI 답변 품질 대시보드 데이터 (최근 N일)")
    @GetMapping("/quality")
    @PreAuthorize("hasRole('ADMIN')")
    public AiQualityDto quality(
            @RequestParam(name = "days", defaultValue = "7") int days,
            @RequestParam(name = "topDocsLimit", defaultValue = "10") int topDocsLimit) {

        int windowDays = Math.min(90, Math.max(1, days));
        int topN = Math.min(50, Math.max(1, topDocsLimit));
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minusDays(windowDays);

        // ---- 일별 helpful/notHelpful (UTC 기준 날짜로 그룹화) -----------------
        Map<String, AiQualityDto.DailyPoint> byDate = new LinkedHashMap<>();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = windowDays - 1; i >= 0; i--) {
            String d = today.minusDays(i).toString();
            byDate.put(d, new AiQualityDto.DailyPoint(d, 0, 0));
        }
        for (Object[] r : feedbackRepo.aggregateDaily(since)) {
            String d = r[0] instanceof java.sql.Date sd ? sd.toLocalDate().toString()
                    : r[0] instanceof LocalDate ld ? ld.toString()
                    : String.valueOf(r[0]);
            long h = ((Number) r[1]).longValue();
            long n = ((Number) r[2]).longValue();
            byDate.put(d, new AiQualityDto.DailyPoint(d, h, n));
        }
        List<AiQualityDto.DailyPoint> daily = new ArrayList<>(byDate.values());

        // ---- 액션별 ----------------------------------------------------------
        long totalHelpful = 0, totalNot = 0;
        List<AiQualityDto.ActionStat> byAction = new ArrayList<>();
        for (Object[] r : feedbackRepo.aggregateByAction(since)) {
            String action = (String) r[0];
            long h = ((Number) r[1]).longValue();
            long n = ((Number) r[2]).longValue();
            totalHelpful += h;
            totalNot += n;
            double rate = (h + n) == 0 ? 0.0 : (double) h / (h + n);
            byAction.add(new AiQualityDto.ActionStat(action, h, n, rate));
        }

        // ---- 피드백 상위 문서 (인용된 문서의 근사치) -------------------------
        List<AiQualityDto.DocStat> topDocs = new ArrayList<>();
        for (Object[] r : feedbackRepo.topDocuments(since, PageRequest.of(0, topN))) {
            topDocs.add(new AiQualityDto.DocStat((String) r[0], ((Number) r[1]).longValue()));
        }

        long totalFeedback = totalHelpful + totalNot;
        double helpfulRate = totalFeedback == 0 ? 0.0 : (double) totalHelpful / totalFeedback;

        // ---- 임계치 (운영 화면에서 즉시 조정 가능; DB 미설정 시 yml 기본값) -
        AiQualityThresholdsService.EffectiveThresholds eff = thresholdsService.current();
        double helpfulRateAlert = eff.helpfulRateThreshold();
        double latencyMeanAlert = eff.latencyMeanAlertMs();
        double latencyP95Alert  = eff.latencyP95AlertMs();
        long   minSamples       = eff.minSamplesForRateAlert();

        // ---- 응답 시간 (마이크로미터에서 누적) -------------------------------
        // 전역 p50/p95는 모든 태그 인스턴스 중 최댓값(=가장 느린 태그)을 채택해 꼬리 지연을
        // 보수적으로 노출한다. 어느 태그가 원인인지 식별할 수 있도록 askByCollection /
        // actionByAction 으로 태그별 분포도 함께 돌려준다. 각 태그 행의 p95ThresholdMs는
        // 컬렉션·액션 단위 오버라이드(yml/env)가 있으면 그 값, 없으면 현재 유효한
        // 전역 기본값(`latencyP95Alert`, DB 오버라이드 반영)을 채워 프런트 강조와
        // 백엔드 경고가 같은 임계치를 공유하게 한다.
        Map<String, Double> askOverrides    = properties.getAskP95AlertMsByCollection();
        Map<String, Double> actionOverrides = properties.getActionP95AlertMsByAction();
        ToDoubleFunction<String> askResolver = tag -> {
            Double v = tag == null ? null : askOverrides.get(tag);
            return v == null ? latencyP95Alert : v;
        };
        ToDoubleFunction<String> actionResolver = tag -> {
            Double v = tag == null ? null : actionOverrides.get(tag);
            return v == null ? latencyP95Alert : v;
        };
        List<AiQualityDto.TagLatency> askByCollection = tagLatencies(
                "knowledge.ai.ask.latency", "collection", askResolver);
        List<AiQualityDto.TagLatency> actionByAction  = tagLatencies(
                "knowledge.ai.action.latency", "action", actionResolver);

        AiQualityDto.Latency latency = new AiQualityDto.Latency(
                meanMs("knowledge.ai.ask.latency"),
                percentileMs("knowledge.ai.ask.latency", 0.5),
                percentileMs("knowledge.ai.ask.latency", 0.95),
                count("knowledge.ai.ask.latency"),
                meanMs("knowledge.ai.action.latency"),
                percentileMs("knowledge.ai.action.latency", 0.5),
                percentileMs("knowledge.ai.action.latency", 0.95),
                count("knowledge.ai.action.latency"),
                latencyP95Alert,
                askByCollection,
                actionByAction);

        List<String> alerts = new ArrayList<>();
        if (totalFeedback >= minSamples && helpfulRate < helpfulRateAlert) {
            alerts.add(String.format(Locale.ROOT,
                    "최근 %d일 도움됨 비율이 %.0f%%로 임계치(%.0f%%) 미만입니다.",
                    windowDays, helpfulRate * 100, helpfulRateAlert * 100));
        }
        if (latency.askMeanMs() > latencyMeanAlert) {
            alerts.add(String.format(Locale.ROOT,
                    "ask 평균 응답 시간이 %.0fms로 %.0fms 임계치를 초과했습니다.",
                    latency.askMeanMs(), latencyMeanAlert));
        }
        // 태그(컬렉션·액션)별로 자기 임계치를 넘으면 개별 경고를 추가한다. 전역 단일
        // "ask p95 초과" 경고는 태그별 임계치를 도입한 시점부터 의미가 모호해지므로
        // (어느 컬렉션이 원인인지 알 수 없음) 태그 단위 메시지로 대체한다.
        for (AiQualityDto.TagLatency r : askByCollection) {
            if (r.p95Ms() > r.p95ThresholdMs()) {
                alerts.add(String.format(Locale.ROOT,
                        "ask 컬렉션 '%s' p95 응답 시간이 %.0fms로 임계치(%.0fms)를 초과했습니다.",
                        r.tag(), r.p95Ms(), r.p95ThresholdMs()));
            }
        }
        for (AiQualityDto.TagLatency r : actionByAction) {
            if (r.p95Ms() > r.p95ThresholdMs()) {
                alerts.add(String.format(Locale.ROOT,
                        "액션 '%s' p95 응답 시간이 %.0fms로 임계치(%.0fms)를 초과했습니다.",
                        r.tag(), r.p95Ms(), r.p95ThresholdMs()));
            }
        }

        AiQualityDto.Thresholds thresholdsDto = new AiQualityDto.Thresholds(
                helpfulRateAlert, latencyMeanAlert, latencyP95Alert, minSamples,
                askOverrides, actionOverrides);
        return new AiQualityDto(windowDays, totalFeedback, helpfulRate, helpfulRateAlert,
                daily, byAction, topDocs, latency, alerts, thresholdsDto);
    }

    // ----------------------------------------- threshold runtime configuration

    @Operation(summary = "현재 적용 중인 AI 품질 경고 임계치")
    @GetMapping("/thresholds")
    @PreAuthorize("hasRole('ADMIN')")
    public AiQualityThresholdsService.EffectiveThresholds getThresholds() {
        return thresholdsService.current();
    }

    @Operation(summary = "AI 품질 경고 임계치 갱신 (즉시 반영, 변경 이력 기록)")
    @PutMapping("/thresholds")
    @PreAuthorize("hasRole('ADMIN')")
    public AiQualityThresholdsService.EffectiveThresholds updateThresholds(
            @RequestBody AiQualityThresholdsService.UpdateRequest req) {
        UUID actor;
        try { actor = CurrentUser.id(); } catch (RuntimeException ex) { actor = null; }
        return thresholdsService.update(req, actor);
    }

    @Operation(summary = "AI 품질 경고 임계치 변경 이력 (최신순)")
    @GetMapping("/thresholds/history")
    @PreAuthorize("hasRole('ADMIN')")
    public java.util.List<AiQualityThresholdsService.HistoryEntry> thresholdsHistory(
            @RequestParam(name = "limit", defaultValue = "20") int limit) {
        return thresholdsService.history(limit);
    }

    @Operation(summary = "특정 컬렉션·액션 태그의 최근 호출 샘플 (느린 행 진단용)")
    @GetMapping("/slow")
    @PreAuthorize("hasRole('ADMIN')")
    public List<SlowCallSampler.Sample> slow(
            @RequestParam(name = "tag") String tag,
            @RequestParam(name = "kind", defaultValue = "ask") String kind,
            @RequestParam(name = "limit", defaultValue = "10") int limit) {
        // kind는 "ask"/"action" 중 하나여야 함. 그 외 값은 빈 배열로 안전하게 응답.
        if (!"ask".equals(kind) && !"action".equals(kind)) return List.of();
        int n = Math.min(50, Math.max(1, limit));
        return slowSampler.recent(kind, tag, n);
    }

    // -------------------------------------------------------------------- helpers

    private double meanMs(String name) {
        double sum = 0.0;
        long count = 0;
        for (Timer t : meters.find(name).timers()) {
            sum += t.totalTime(TimeUnit.MILLISECONDS);
            count += t.count();
        }
        return count == 0 ? 0.0 : sum / count;
    }

    private long count(String name) {
        long c = 0;
        for (Timer t : meters.find(name).timers()) c += t.count();
        return c;
    }

    /**
     * 같은 이름의 Timer들이 태그별로 여러 개 등록돼 있으므로(collection/action 등)
     * 모든 인스턴스의 스냅샷을 훑어 해당 percentile의 최댓값(=가장 느린 태그)을 돌려준다.
     * Timer.builder 단계에서 publishPercentiles(0.5, 0.95)가 켜져 있어야 값이 나온다.
     */
    private double percentileMs(String name, double percentile) {
        double max = 0.0;
        for (Timer t : meters.find(name).timers()) {
            for (var v : t.takeSnapshot().percentileValues()) {
                if (Math.abs(v.percentile() - percentile) < 1e-6) {
                    double ms = v.value(TimeUnit.MILLISECONDS);
                    if (ms > max) max = ms;
                }
            }
        }
        return max;
    }

    /**
     * 지정한 태그 키별로 Timer 인스턴스를 모아 mean/p50/p95/count와 해당 태그에
     * 적용되는 p95 임계치(오버라이드 또는 전역 기본값)를 반환한다.
     * p95 내림차순으로 정렬해 가장 느린 태그가 위로 오도록 한다.
     */
    private List<AiQualityDto.TagLatency> tagLatencies(
            String name, String tagKey, ToDoubleFunction<String> p95ThresholdResolver) {
        List<AiQualityDto.TagLatency> out = new ArrayList<>();
        for (Timer t : meters.find(name).timers()) {
            String tag = t.getId().getTag(tagKey);
            if (tag == null || tag.isBlank()) continue;
            long c = t.count();
            if (c == 0) continue;
            double mean = t.totalTime(TimeUnit.MILLISECONDS) / (double) c;
            double p50 = 0.0, p95 = 0.0;
            for (var v : t.takeSnapshot().percentileValues()) {
                double ms = v.value(TimeUnit.MILLISECONDS);
                if (Math.abs(v.percentile() - 0.5) < 1e-6) p50 = ms;
                else if (Math.abs(v.percentile() - 0.95) < 1e-6) p95 = ms;
            }
            out.add(new AiQualityDto.TagLatency(
                    tag, mean, p50, p95, c, p95ThresholdResolver.applyAsDouble(tag)));
        }
        out.sort(Comparator.comparingDouble(AiQualityDto.TagLatency::p95Ms).reversed());
        return out;
    }
}
