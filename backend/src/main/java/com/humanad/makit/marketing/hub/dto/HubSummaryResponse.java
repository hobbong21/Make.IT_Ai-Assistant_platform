package com.humanad.makit.marketing.hub.dto;

public record HubSummaryResponse(
    int activeCampaigns,
    int totalContents,
    int publishedThisWeek,
    double avgEngagement
) {}
