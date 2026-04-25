package com.humanad.makit.marketing.hub;

import com.humanad.makit.marketing.hub.dto.*;

import java.util.List;
import java.util.UUID;

public interface MarketingHubService {

    HubSummaryResponse getSummary(UUID userId);

    List<CampaignDto> listCampaigns(UUID userId, String status);

    List<ContentDto> listRecentContents(UUID userId, int limit);

    List<CalendarBucket> getWeekCalendar(UUID userId);

    List<ChannelPerformance> getChannelPerformance(UUID userId, int days);

    // ============= Campaign CRUD =============

    /**
     * Create a new campaign. Initializes status to DRAFT.
     */
    CampaignDto createCampaign(UUID userId, CampaignCreateRequest req);

    /**
     * Get a single campaign by ID (ownership verified).
     */
    CampaignDto getCampaign(UUID userId, Long campaignId);

    /**
     * Update campaign fields. Only non-null fields are updated (PATCH semantics).
     */
    CampaignDto updateCampaign(UUID userId, Long campaignId, CampaignUpdateRequest req);

    /**
     * Change campaign status. Validates state machine transitions.
     */
    CampaignDto changeCampaignStatus(UUID userId, Long campaignId, String newStatus);

    /**
     * Delete campaign (ownership verified).
     */
    void deleteCampaign(UUID userId, Long campaignId);
}
