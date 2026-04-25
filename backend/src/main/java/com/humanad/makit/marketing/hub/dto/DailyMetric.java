package com.humanad.makit.marketing.hub.dto;

import java.time.LocalDate;

public record DailyMetric(
    LocalDate date,
    double value
) {}
