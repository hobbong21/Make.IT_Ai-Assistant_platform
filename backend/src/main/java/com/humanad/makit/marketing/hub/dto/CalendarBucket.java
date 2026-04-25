package com.humanad.makit.marketing.hub.dto;

import java.time.LocalDate;

public record CalendarBucket(
    LocalDate date,
    int campaignCount,
    int contentCount,
    int totalCount
) {}
