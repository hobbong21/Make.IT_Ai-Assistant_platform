package com.humanad.makit.dashboard;

import java.util.List;
import java.util.UUID;

/**
 * Dashboard service contract — retrieves statistical summaries for authenticated users.
 */
public interface DashboardService {

    /**
     * Get dashboard statistics for the given user.
     *
     * Aggregates:
     * - Total user count (global)
     * - Current user's accumulated service request count
     * - Current user's active job count
     * - Top 3 services by usage
     * - Last login timestamp
     */
    DashboardStatsResponse getStats(UUID userId);

    /**
     * Get user activity time-series for the last N days.
     * Returns activity count grouped by date, filling in zero-count dates.
     *
     * @param userId the user ID
     * @param days   number of days to retrieve (clamped between 1 and 30)
     * @return list of activity buckets, one per day, newest first
     */
    List<ActivityBucket> activityBuckets(UUID userId, int days);
}
