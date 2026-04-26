package com.humanad.makit.admin;

import com.humanad.makit.admin.dto.AdminOverviewDto;
import com.humanad.makit.admin.dto.AdminUserDto;
import com.humanad.makit.admin.dto.FeatureManifestDto;
import com.humanad.makit.admin.dto.NotificationBreakdownDto;
import com.humanad.makit.admin.dto.UsageDto;
import com.humanad.makit.audit.AuditLog;
import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.auth.User;
import com.humanad.makit.auth.UserRepository;
import com.humanad.makit.job.JobExecutionRepository;
import com.humanad.makit.notification.NotificationRepository;
import com.humanad.makit.observability.MetricsAspect;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminServiceImpl implements AdminService {

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationRepository notificationRepository;
    private final JobExecutionRepository jobExecutionRepository;
    private final FeatureCatalogService featureCatalogService;
    private final MetricsAspect metricsAspect;

    @Override
    public AdminOverviewDto getOverview() {
        long totalUsers = userRepository.count();

        OffsetDateTime sevenDaysAgo = OffsetDateTime.now().minus(7, ChronoUnit.DAYS);
        long activeUsersLast7Days = userRepository.countActiveUsersSince(sevenDaysAgo);
        long totalRequestsLast7Days = auditLogRepository.countRequestsSince(sevenDaysAgo);

        // For jobs, query for PENDING+RUNNING (in progress) + COMPLETED in last 7 days
        long totalJobsLast7Days = 0; // stub: jobs table needs date-based query

        long totalNotificationsLast7Days = notificationRepository.countSince(sevenDaysAgo);

        return new AdminOverviewDto(
            totalUsers,
            activeUsersLast7Days,
            totalRequestsLast7Days,
            totalJobsLast7Days,
            totalNotificationsLast7Days
        );
    }

    @Override
    public Page<AdminUserDto> getUsers(int page, int size) {
        List<User> users = userRepository.findAllForAdmin();

        // Convert to AdminUserDto with request count
        List<AdminUserDto> dtos = users.stream().map(u -> {
            long requestCount = auditLogRepository.countByUserId(u.getId());
            return new AdminUserDto(
                u.getId(),
                u.getEmail(),
                u.getName(),
                u.getRole().name(),
                u.getCreatedAt(),
                u.getLastLoginAt(),
                requestCount
            );
        }).toList();

        // Simple pagination
        int start = page * size;
        int end = Math.min(start + size, dtos.size());
        List<AdminUserDto> pageContent = start < dtos.size() ? dtos.subList(start, end) : Collections.emptyList();

        return new PageImpl<>(pageContent, PageRequest.of(page, size), dtos.size());
    }

    @Override
    public List<UsageDto> getUsage(int days) {
        List<Object[]> rows = auditLogRepository.findUsageByDay(days);
        return rows.stream().map(row -> {
            String date = (String) row[0];
            long requests = ((Number) row[1]).longValue();
            long errors = ((Number) row[2]).longValue();
            long jobs = row.length > 3 ? ((Number) row[3]).longValue() : 0;
            return new UsageDto(date, requests, jobs, errors);
        }).toList();
    }

    @Override
    public NotificationBreakdownDto getNotificationBreakdown(int days) {
        OffsetDateTime since = OffsetDateTime.now().minus(days, ChronoUnit.DAYS);

        // Count by type
        List<Object[]> typeRows = notificationRepository.countByTypeLastDays(days);
        Map<String, Long> byType = new LinkedHashMap<>();
        for (Object[] row : typeRows) {
            String type = (String) row[0];
            long count = ((Number) row[1]).longValue();
            byType.put(type, count);
        }

        long totalNotifs = notificationRepository.countSince(since);
        long unreadCount = notificationRepository.countUnreadSince(since);
        long clickedCount = totalNotifs - unreadCount; // approximate
        double ctr = totalNotifs > 0 ? (double) clickedCount / totalNotifs : 0.0;

        return new NotificationBreakdownDto(byType, clickedCount, unreadCount, ctr);
    }

    @Override
    public List<FeatureManifestDto> listFeatures() {
        return featureCatalogService.listFeatures();
    }

    @Override
    public Map<String, Object> getFeatureDetail(String name) {
        return featureCatalogService.getFeatureDetail(name);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRED)
    public void updateFeatureStatus(String featureName, String newStatus) {
        try {
            // Read current manifest to get old status
            Map<String, Object> detail = featureCatalogService.getFeatureDetail(featureName);
            @SuppressWarnings("unchecked")
            Map<String, Object> manifest = (Map<String, Object>) detail.get("manifest");
            String oldStatus = manifest != null ? (String) manifest.getOrDefault("status", "unknown") : "unknown";

            // Update manifest.json file
            featureCatalogService.updateFeatureStatus(featureName, newStatus);

            // Write structured audit log in a separate transaction
            writeFeatureLifecycleAudit(featureName, oldStatus, newStatus);

            log.info("Feature {} lifecycle: {} -> {}", featureName, oldStatus, newStatus);
        } catch (Exception ex) {
            log.error("Failed to update feature {} status: {}", featureName, ex.getMessage(), ex);
            throw new RuntimeException("Failed to update feature status: " + ex.getMessage(), ex);
        }
    }

    /**
     * Write feature lifecycle change to audit_logs with structured metadata.
     * Uses REQUIRES_NEW to persist even if caller rolls back.
     * Also records Prometheus metrics for the status change.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    private void writeFeatureLifecycleAudit(String featureName, String oldStatus, String newStatus) {
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setResource("feature-lifecycle");
            auditLog.setAction("STATUS_CHANGE");

            // Get authenticated user
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null) {
                try {
                    auditLog.setUserId(UUID.fromString(auth.getName()));
                } catch (Exception ignored) {
                    // User principal may not be a UUID
                }
            }

            // Structured metadata
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("featureName", featureName);
            metadata.put("oldStatus", oldStatus);
            metadata.put("newStatus", newStatus);
            metadata.put("changedBy", auth != null ? auth.getName() : "unknown");
            metadata.put("timestamp", OffsetDateTime.now().toString());
            auditLog.setMetadata(metadata);

            auditLogRepository.save(auditLog);

            // Record Prometheus metric for lifecycle change
            try {
                metricsAspect.recordLifecycleChange(oldStatus, newStatus);
            } catch (Exception ex) {
                log.debug("Failed to record lifecycle change metric: {}", ex.getMessage());
            }
        } catch (Exception ex) {
            log.warn("Failed to write feature lifecycle audit for {}: {}", featureName, ex.getMessage());
        }
    }
}
