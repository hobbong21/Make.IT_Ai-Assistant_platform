package com.humanad.makit.dashboard;

import com.humanad.makit.audit.AuditLog;
import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.auth.UserRepository;
import com.humanad.makit.auth.User;
import com.humanad.makit.job.JobExecutionRepository;
import com.humanad.makit.job.JobExecution;
import com.humanad.makit.job.JobStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dashboard service implementation — aggregates statistics for authenticated users.
 *
 * First iteration uses stub data and basic repository counts. Future iterations
 * will implement full audit_logs / jobs table queries for accurate aggregations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final JobExecutionRepository jobExecutionRepository;

    /**
     * Service key to display name mapping.
     * Maps the service keys from the frontend to user-friendly labels.
     */
    private static final Map<String, String> SERVICE_DISPLAY_NAMES = Map.ofEntries(
            Map.entry("nlp-analyze", "NLP 분석"),
            Map.entry("youtube-comments", "YouTube 댓글 분석"),
            Map.entry("youtube-influence", "YouTube 영향력 분석"),
            Map.entry("youtube-keyword-search", "YouTube 키워드 검색"),
            Map.entry("url-analyze", "URL 분석"),
            Map.entry("feed-generate", "피드 생성"),
            Map.entry("remove-bg", "배경 제거"),
            Map.entry("chatbot", "챗봇"),
            Map.entry("review-analysis", "리뷰 분석"),
            Map.entry("modelshot", "모델샷")
    );

    @Override
    public DashboardStatsResponse getStats(UUID userId) {
        try {
            // Global user count.
            long userCount = userRepository.count();

            // If user is not authenticated, return safe defaults.
            if (userId == null) {
                log.warn("getStats called with null userId; returning default stats");
                return new DashboardStatsResponse(userCount, 0L, 0, new ArrayList<>(), null);
            }

            // User's cumulative request count from audit logs.
            long myRequestCount = auditLogRepository.countByUserId(userId);

            // User's active job count (PENDING + RUNNING).
            int myJobsInProgress = jobExecutionRepository.countByUserIdAndStatusIn(
                    userId,
                    List.of("PENDING", "RUNNING")
            );

            // Top 3 services by usage frequency.
            List<ServiceUsageDto> topServices = new ArrayList<>();
            Pageable top3 = PageRequest.of(0, 3);
            List<Object[]> topResources = auditLogRepository.findTopResourcesByUser(userId, top3);
            for (Object[] row : topResources) {
                String resource = (String) row[0];
                long count = ((Number) row[1]).longValue();
                String displayName = SERVICE_DISPLAY_NAMES.getOrDefault(resource, resource);
                topServices.add(new ServiceUsageDto(resource, count, displayName));
            }

            // User's last login timestamp (from most recent LOGIN action in audit logs).
            Instant lastLoginAt = null;
            var lastLoginLog = auditLogRepository.findFirstByUserIdAndActionOrderByCreatedAtDesc(userId, "LOGIN");
            if (lastLoginLog.isPresent()) {
                OffsetDateTime createdAt = lastLoginLog.get().getCreatedAt();
                if (createdAt != null) {
                    lastLoginAt = createdAt.toInstant();
                }
            }

            return new DashboardStatsResponse(
                    userCount,
                    myRequestCount,
                    myJobsInProgress,
                    topServices,
                    lastLoginAt
            );
        } catch (Exception e) {
            log.error("Error retrieving dashboard stats for user {}", userId, e);
            return defaultStats();
        }
    }

    /**
     * Return default (safe) stats when computation fails.
     */
    private DashboardStatsResponse defaultStats() {
        return new DashboardStatsResponse(
                0L,
                0L,
                0,
                new ArrayList<>(),
                null
        );
    }

    @Override
    public List<ActivityBucket> activityBuckets(UUID userId, int days) {
        try {
            if (userId == null) {
                log.warn("activityBuckets called with null userId; returning empty list");
                return new ArrayList<>();
            }

            // Clamp days between 1 and 30
            int clampedDays = Math.max(1, Math.min(30, days));

            // Fetch activity counts grouped by date using native query
            List<Object[]> rawResults = auditLogRepository.findActivityByDay(userId, clampedDays);

            // Build a map of date -> count
            Map<LocalDate, Long> countsByDate = new HashMap<>();
            for (Object[] row : rawResults) {
                String dayStr = (String) row[0]; // "YYYY-MM-DD"
                long count = ((Number) row[1]).longValue();
                try {
                    LocalDate date = LocalDate.parse(dayStr);
                    countsByDate.put(date, count);
                } catch (Exception ex) {
                    log.warn("Failed to parse activity date: {}", dayStr, ex);
                }
            }

            // Fill in missing dates with zero counts
            LocalDate today = LocalDate.now();
            List<ActivityBucket> result = new ArrayList<>();

            for (int i = 0; i < clampedDays; i++) {
                LocalDate date = today.minusDays(i);
                long count = countsByDate.getOrDefault(date, 0L);
                result.add(new ActivityBucket(date, count));
            }

            // Reverse to return oldest first (optional; frontend may prefer oldest-first)
            // For now, keep as is (newest first)
            return result;

        } catch (Exception e) {
            log.error("Error retrieving activity buckets for user {}", userId, e);
            return new ArrayList<>();
        }
    }
}
