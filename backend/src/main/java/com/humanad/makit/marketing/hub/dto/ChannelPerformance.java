package com.humanad.makit.marketing.hub.dto;

import java.util.List;

public record ChannelPerformance(
    String channel,
    List<DailyMetric> series,
    double total,
    double avg
) {}
