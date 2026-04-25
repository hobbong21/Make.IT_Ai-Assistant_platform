package com.humanad.makit.dashboard;

import java.time.LocalDate;

/**
 * Activity bucket — represents the count of actions performed by a user on a specific date.
 * Used for activity time-series visualization (e.g., 7-day activity chart).
 */
public record ActivityBucket(
        LocalDate date,
        long count
) {}
