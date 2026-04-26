package com.humanad.makit.notification.push.analytics;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * Push notification analytics response DTO.
 */
public record PushAnalyticsDto(
    long sent,
    long clicked,
    long failed,
    long expired,
    double ctr, // (clicked / sent) * 100, or 0 if sent == 0
    double bounceRate, // ((failed + expired) / sent) * 100, or 0 if sent == 0
    List<DailyBucket> byDay
) {
    public record DailyBucket(
        String date,
        long sent,
        long clicked
    ) {}
}
