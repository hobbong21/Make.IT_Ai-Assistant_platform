package com.humanad.makit.dashboard;

/**
 * Service usage record — tracks calls to a specific service by the current user.
 */
public record ServiceUsageDto(
        String serviceKey,
        long count,
        String displayName
) {}
