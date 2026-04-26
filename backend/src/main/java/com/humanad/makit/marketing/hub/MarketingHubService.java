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

    // ============ Content CRUD =============

    ContentDto createContent(UUID userId, ContentCreateRequest req);

    ContentDto getContent(UUID userId, Long contentId);

    ContentDto updateContent(UUID userId, Long contentId, ContentUpdateRequest req);

    void deleteContent(UUID userId, Long contentId);

    // ============ Campaign CRUD =============

    CampaignDto createCampaign(UUID userId, CampaignCreateRequest req);

    CampaignDto getCampaign(UUID userId, Long campaignId);

    CampaignDto updateCampaign(UUID userId, Long campaignId, CampaignUpdateRequest req);

    CampaignDto changeCampaignStatus(UUID userId, Long campaignId, CampaignStatusChangeRequest req);

    void deleteCampaign(UUID userId, Long campaignId);
}
