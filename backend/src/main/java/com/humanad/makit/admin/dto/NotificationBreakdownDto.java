package com.humanad.makit.admin.dto;

import java.util.Map;

public record NotificationBreakdownDto(
    Map<String, Long> byType,
    long clicked,
    long unread,
    double clickThroughRate
) {}
