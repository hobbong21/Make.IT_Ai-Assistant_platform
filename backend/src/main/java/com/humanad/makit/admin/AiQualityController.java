package com.humanad.makit.admin;

import com.humanad.makit.common.AuthenticationException;
import com.humanad.makit.knowledge.ai.OfficeHubFeedbackRepository;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

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

    /** helpful 비율이 이 값 미만이면 경고 배너를 띄운다. */
    static final double HELPFUL_RATE_ALERT = 0.70;
    /** ask 평균 응답시간(ms)이 이 값을 넘으면 경고 배너를 띄운다. */
    static final double LATENCY_ALERT_MS = 6000.0;
    /** 표본이 너무 적으면 helpful-rate 경고는 잠재운다. */
    static final long MIN_SAMPLES_FOR_RATE_ALERT = 5;

    private final OfficeHubFeedbackRepository feedbackRepo;
    private final MeterRegistry meters;

    @Operation(summary = "AI 답변 품질 대시보드 데이터 (최근 N일)")
    @GetMapping("/quality")
    public AiQualityDto quality(
            @RequestParam(name = "days", defaultValue = "7") int days,
            @RequestParam(name = "topDocsLimit", defaultValue = "10") int topDocsLimit) {

        requireAdmin();
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

        // ---- 응답 시간 (마이크로미터에서 누적) -------------------------------
        AiQualityDto.Latency latency = new AiQualityDto.Latency(
                meanMs("knowledge.ai.ask.latency"),
                count("knowledge.ai.ask.latency"),
                meanMs("knowledge.ai.action.latency"),
                count("knowledge.ai.action.latency"));

        // ---- 경고 -----------------------------------------------------------
        List<String> alerts = new ArrayList<>();
        if (totalFeedback >= MIN_SAMPLES_FOR_RATE_ALERT && helpfulRate < HELPFUL_RATE_ALERT) {
            alerts.add(String.format(Locale.ROOT,
                    "최근 %d일 도움됨 비율이 %.0f%%로 임계치(%.0f%%) 미만입니다.",
                    windowDays, helpfulRate * 100, HELPFUL_RATE_ALERT * 100));
        }
        if (latency.askMeanMs() > LATENCY_ALERT_MS) {
            alerts.add(String.format(Locale.ROOT,
                    "ask 평균 응답 시간이 %.0fms로 %.0fms 임계치를 초과했습니다.",
                    latency.askMeanMs(), LATENCY_ALERT_MS));
        }

        return new AiQualityDto(windowDays, totalFeedback, helpfulRate, HELPFUL_RATE_ALERT,
                daily, byAction, topDocs, latency, alerts);
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
     * 메서드 보안(@PreAuthorize)이 활성화돼 있지 않으므로 컨트롤러에서 직접
     * ROLE_ADMIN 권한을 검사한다. 다른 관리자 엔드포인트가 추가되면
     * SecurityConfig에 EnableMethodSecurity를 켜는 편이 더 깔끔하지만,
     * 이번 작업에서는 보안 설정 변경 없이 최소한의 수정만 한다.
     */
    private static void requireAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw new AuthenticationException("Not authenticated");
        }
        for (GrantedAuthority a : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(a.getAuthority())) return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "ADMIN role required");
    }
}
