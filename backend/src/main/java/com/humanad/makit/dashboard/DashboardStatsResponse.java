package com.humanad.makit.dashboard;

import java.time.Instant;
import java.util.List;

/**
 * Dashboard statistics snapshot — aggregates user, request, job, and service usage metrics.
 */
public record DashboardStatsResponse(
        long userCount,
        long myRequestCount,
        int myJobsInProgress,
        List<ServiceUsageDto> topServices,
        Instant lastLoginAt
) {}
