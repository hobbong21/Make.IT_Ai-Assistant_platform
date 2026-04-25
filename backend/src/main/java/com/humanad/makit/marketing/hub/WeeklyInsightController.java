package com.humanad.makit.marketing.hub;

import com.humanad.makit.audit.Auditable;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * 주간 AI 인사이트 — 마케팅 허브의 핵심 카드.
 *
 * 사용자의 지난 7일 audit_logs 를 분석하여 Bedrock Claude 에 전달.
 * Claude가 실제 사용 패턴 기반의 개인화된 마케팅 인사이트를 생성.
 * Bedrock 실패 시 자동으로 stub 데이터로 fallback.
 */
@RestController
@RequestMapping("/api/marketing/insights")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "marketing-insights")
public class WeeklyInsightController {

    private final WeeklyInsightService insightService;

    @GetMapping("/weekly")
    @Auditable(resource = "marketing-insights-weekly", action = "READ")
    public Map<String, Object> weekly() {
        UUID userId = extractUserId();
        log.info("Generating weekly insight for user {}", userId);
        return insightService.generateWeeklyInsight(userId);
    }

    private UUID extractUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()) {
            try {
                return UUID.fromString(auth.getName());
            } catch (IllegalArgumentException e) {
                log.warn("Failed to parse userId from authentication: {}", auth.getName());
            }
        }
        return UUID.randomUUID();
    }
}
