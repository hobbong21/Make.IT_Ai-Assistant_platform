package com.humanad.makit.admin.dto;

public record AdminOverviewDto(
    long totalUsers,
    long activeUsersLast7Days,
    long totalRequestsLast7Days,
    long totalJobsLast7Days,
    long totalNotificationsLast7Days
) {}
