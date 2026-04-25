package com.humanad.makit.marketing.hub;

import java.util.Map;
import java.util.UUID;

/**
 * Service for generating weekly AI marketing insights.
 * Integrates with Bedrock Claude to create intelligent insights from audit data.
 */
public interface WeeklyInsightService {

    /**
     * Generate a weekly insight for the user based on their activity from the last 7 days.
     *
     * @param userId the user's UUID
     * @return Map containing:
     *   - weekStart: ISO date string
     *   - weekEnd: ISO date string
     *   - markdown: the insight in markdown format
     *   - generatedAt: ISO instant
     *   - source: "bedrock-claude" or "stub-rule-based"
     */
    Map<String, Object> generateWeeklyInsight(UUID userId);
}
