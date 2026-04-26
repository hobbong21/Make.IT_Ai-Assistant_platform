package com.humanad.makit.notification.push.analytics;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * Push notification analytics endpoints.
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications/push")
@RequiredArgsConstructor
public class PushAnalyticsController {

    private final PushAnalyticsRepository analyticsRepository;

    /**
     * GET /api/notifications/push/analytics?days=7
     * Return 7-day push analytics: sent, clicked, failed, expired, CTR, bounce rate, daily breakdown.
     */
    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics(
        @RequestParam(defaultValue = "7") int days,
        Authentication auth
    ) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of(
                "errorCode", "UNAUTHORIZED",
                "message", "로그인이 필요합니다"
            ));
        }

        try {
            UUID userId = UUID.fromString(auth.getName());
            // Clamp days to 1-365
            days = Math.max(1, Math.min(365, days));

            OffsetDateTime startTime = OffsetDateTime.now().minusDays(days);

            // Get aggregate stats
            Map<String, Long> stats = analyticsRepository.getAggregateStats(userId, startTime);
            long sent = stats.getOrDefault("sent", 0L);
            long clicked = stats.getOrDefault("clicked", 0L);
            long failed = stats.getOrDefault("failed", 0L);
            long expired = stats.getOrDefault("expired", 0L);

            // Calculate CTR and bounce rate
            double ctr = sent > 0 ? (clicked * 100.0 / sent) : 0;
            double bounceRate = sent > 0 ? ((failed + expired) * 100.0 / sent) : 0;

            // Get daily breakdown
            var dailyStats = analyticsRepository.getDailyStats(userId, startTime);
            var byDay = dailyStats.stream()
                .map(row -> new PushAnalyticsDto.DailyBucket(
                    row.get("date").toString(),
                    ((Number) row.get("sent")).longValue(),
                    ((Number) row.get("clicked")).longValue()
                ))
                .toList();

            var response = new PushAnalyticsDto(sent, clicked, failed, expired, ctr, bounceRate, byDay);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Failed to fetch push analytics", e);
            return ResponseEntity.status(500).body(Map.of(
                "errorCode", "ANALYTICS_ERROR",
                "message", "분석 데이터 조회 실패"
            ));
        }
    }

    /**
     * POST /api/notifications/push/track-click
     * Record a push notification click event.
     * Body: { notificationId, tag, url }
     */
    @PostMapping("/track-click")
    public ResponseEntity<?> trackClick(
        @RequestBody TrackClickRequest request,
        Authentication auth
    ) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of(
                "errorCode", "UNAUTHORIZED",
                "message", "로그인이 필요합니다"
            ));
        }

        try {
            UUID userId = UUID.fromString(auth.getName());

            PushAnalyticsEntity event = new PushAnalyticsEntity();
            event.setUserId(userId);
            event.setNotificationId(request.notificationId());
            event.setEventType(PushAnalyticsEntity.EventType.CLICKED);
            event.setMetadata(String.format("{\"tag\":\"%s\",\"url\":\"%s\"}", request.tag(), request.url()));

            analyticsRepository.save(event);
            log.debug("Push click tracked: userId={}, notificationId={}", userId, request.notificationId());

            return ResponseEntity.ok(Map.of("message", "클릭 기록됨"));

        } catch (Exception e) {
            log.warn("Failed to track push click (non-fatal)", e);
            // Don't fail the click navigation; just log it
            return ResponseEntity.status(500).body(Map.of(
                "errorCode", "TRACK_ERROR",
                "message", "클릭 기록 실패"
            ));
        }
    }

    public record TrackClickRequest(
        Long notificationId,
        String tag,
        String url
    ) {}
}
