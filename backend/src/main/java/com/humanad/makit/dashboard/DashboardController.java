package com.humanad.makit.dashboard;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Dashboard controller — exposes analytics and statistics endpoints.
 * Requires authentication (protected by SecurityConfig /api/** filter).
 */
@Slf4j
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    /**
     * GET /api/dashboard/stats
     *
     * Returns aggregated dashboard statistics for the authenticated user.
     * Includes global user count, user-specific request/job counts, and top services.
     *
     * @return DashboardStatsResponse with user and service metrics
     */
    @GetMapping("/stats")
    @Operation(summary = "Get dashboard statistics for authenticated user")
    public ResponseEntity<DashboardStatsResponse> getStats() {
        UUID userId = currentUserId();
        DashboardStatsResponse stats = dashboardService.getStats(userId);
        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/dashboard/activity
     *
     * Returns user activity time-series for the last N days.
     * Useful for activity charts and trend analysis.
     *
     * @param days number of days to retrieve (1-30, defaults to 7)
     * @return list of ActivityBucket objects with date and activity count
     */
    @GetMapping("/activity")
    @Operation(summary = "Get user activity time-series for the last N days")
    public ResponseEntity<List<ActivityBucket>> getActivity(
            @RequestParam(defaultValue = "7") int days
    ) {
        UUID userId = currentUserId();
        List<ActivityBucket> buckets = dashboardService.activityBuckets(userId, days);
        return ResponseEntity.ok(buckets);
    }

    /**
     * Extract the authenticated user's ID from the Spring Security context.
     */
    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            return UUID.fromString(auth.getName());
        } catch (Exception ex) {
            log.warn("Failed to extract user ID from authentication", ex);
            return UUID.randomUUID();
        }
    }
}
