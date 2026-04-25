package com.humanad.makit.marketing.hub;

import com.humanad.makit.marketing.campaign.Campaign;
import com.humanad.makit.marketing.campaign.CampaignRepository;
import com.humanad.makit.marketing.content.Content;
import com.humanad.makit.marketing.content.ContentRepository;
import com.humanad.makit.marketing.hub.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketingHubServiceImpl implements MarketingHubService {

    private final CampaignRepository campaignRepository;
    private final ContentRepository contentRepository;

    // ============ State Machine =============
    private static final Map<Campaign.Status, Set<Campaign.Status>> ALLOWED_TRANSITIONS = Map.ofEntries(
        Map.entry(Campaign.Status.DRAFT, Set.of(
            Campaign.Status.SCHEDULED, Campaign.Status.ACTIVE
        )),
        Map.entry(Campaign.Status.SCHEDULED, Set.of(
            Campaign.Status.ACTIVE, Campaign.Status.DRAFT
        )),
        Map.entry(Campaign.Status.ACTIVE, Set.of(
            Campaign.Status.PAUSED, Campaign.Status.COMPLETED
        )),
        Map.entry(Campaign.Status.PAUSED, Set.of(
            Campaign.Status.ACTIVE, Campaign.Status.COMPLETED
        )),
        Map.entry(Campaign.Status.COMPLETED, Set.of()),
        Map.entry(Campaign.Status.ARCHIVED, Set.of())
    );

    @Override
    public HubSummaryResponse getSummary(UUID userId) {
        try {
            int activeCampaigns = campaignRepository.countActiveCampaigns(userId);
            int totalContents = contentRepository.countByUserId(userId);
            
            OffsetDateTime weekAgo = OffsetDateTime.now().minusWeeks(1);
            int publishedThisWeek = contentRepository.countPublishedSince(userId, weekAgo);
            
            double avgEngagement = publishedThisWeek > 0 ? 0.0 : 0.0;
            
            return new HubSummaryResponse(activeCampaigns, totalContents, publishedThisWeek, avgEngagement);
        } catch (Exception e) {
            log.warn("Error fetching hub summary for user {}: {}", userId, e.getMessage());
            return new HubSummaryResponse(0, 0, 0, 0.0);
        }
    }

    @Override
    public List<CampaignDto> listCampaigns(UUID userId, String status) {
        try {
            List<Campaign> campaigns;
            if (status != null && !status.isEmpty()) {
                try {
                    Campaign.Status statusEnum = Campaign.Status.valueOf(status.toUpperCase());
                    campaigns = campaignRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, statusEnum);
                } catch (IllegalArgumentException e) {
                    log.warn("Invalid status: {}", status);
                    campaigns = campaignRepository.findByUserIdOrderByCreatedAtDesc(userId);
                }
            } else {
                campaigns = campaignRepository.findByUserIdOrderByCreatedAtDesc(userId);
            }

            return campaigns.stream()
                    .map(this::toCampaignDto)
                    .toList();
        } catch (Exception e) {
            log.warn("Error listing campaigns for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public List<ContentDto> listRecentContents(UUID userId, int limit) {
        try {
            Pageable pageable = PageRequest.of(0, limit);
            List<Content> contents = contentRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
            
            return contents.stream()
                    .map(c -> new ContentDto(
                            c.getId(),
                            c.getTitle(),
                            c.getType(),
                            c.getImageUrl(),
                            c.getCreatedAt(),
                            "unknown"
                    ))
                    .toList();
        } catch (Exception e) {
            log.warn("Error listing recent contents for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public List<CalendarBucket> getWeekCalendar(UUID userId) {
        try {
            List<CalendarBucket> buckets = new ArrayList<>();
            LocalDate today = LocalDate.now();
            
            for (int i = 0; i < 7; i++) {
                LocalDate date = today.plusDays(i);
                buckets.add(new CalendarBucket(date, 0, 0, 0));
            }
            
            return buckets;
        } catch (Exception e) {
            log.warn("Error fetching week calendar for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    @Override
    public List<ChannelPerformance> getChannelPerformance(UUID userId, int days) {
        try {
            String[] channels = {"INSTAGRAM", "YOUTUBE", "SEO", "ADS"};
            List<ChannelPerformance> performance = new ArrayList<>();

            for (String channel : channels) {
                List<DailyMetric> series = new ArrayList<>();
                LocalDate today = LocalDate.now();

                for (int i = days - 1; i >= 0; i--) {
                    LocalDate date = today.minusDays(i);
                    series.add(new DailyMetric(date, 0.0));
                }

                performance.add(new ChannelPerformance(channel, series, 0.0, 0.0));
            }

            return performance;
        } catch (Exception e) {
            log.warn("Error fetching channel performance for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ============ Campaign CRUD =============

    @Override
    public CampaignDto createCampaign(UUID userId, CampaignCreateRequest req) {
        try {
            Campaign campaign = new Campaign();
            campaign.setUserId(userId);
            campaign.setName(req.name());
            campaign.setDescription(req.description());
            campaign.setStatus(Campaign.Status.DRAFT);

            // Parse channel enum
            try {
                campaign.setChannel(Campaign.Channel.valueOf(req.channel().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid channel: " + req.channel());
            }

            campaign.setStartDate(req.startDate());
            campaign.setEndDate(req.endDate());

            campaign = campaignRepository.save(campaign);
            log.info("Campaign created: id={} userId={} name={}", campaign.getId(), userId, campaign.getName());
            return toCampaignDto(campaign);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error creating campaign for user {}: {}", userId, e.getMessage());
            throw new RuntimeException("Failed to create campaign", e);
        }
    }

    @Override
    public CampaignDto getCampaign(UUID userId, Long campaignId) {
        Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> {
                    log.warn("Campaign not found or access denied: id={} userId={}", campaignId, userId);
                    return new AccessDeniedException("Not the owner of this campaign");
                });
        return toCampaignDto(campaign);
    }

    @Override
    public CampaignDto updateCampaign(UUID userId, Long campaignId, CampaignUpdateRequest req) {
        Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> {
                    log.warn("Campaign not found or access denied: id={} userId={}", campaignId, userId);
                    return new AccessDeniedException("Not the owner of this campaign");
                });

        if (req.name() != null && !req.name().isBlank()) {
            campaign.setName(req.name());
        }
        if (req.description() != null) {
            campaign.setDescription(req.description());
        }
        if (req.startDate() != null) {
            campaign.setStartDate(req.startDate());
        }
        if (req.endDate() != null) {
            campaign.setEndDate(req.endDate());
        }
        if (req.channel() != null && !req.channel().isBlank()) {
            try {
                campaign.setChannel(Campaign.Channel.valueOf(req.channel().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("Invalid channel: " + req.channel());
            }
        }

        campaign = campaignRepository.save(campaign);
        log.info("Campaign updated: id={} userId={}", campaignId, userId);
        return toCampaignDto(campaign);
    }

    @Override
    public CampaignDto changeCampaignStatus(UUID userId, Long campaignId, String newStatusStr) {
        Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> {
                    log.warn("Campaign not found or access denied: id={} userId={}", campaignId, userId);
                    return new AccessDeniedException("Not the owner of this campaign");
                });

        Campaign.Status oldStatus = campaign.getStatus();
        Campaign.Status newStatus;

        try {
            newStatus = Campaign.Status.valueOf(newStatusStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + newStatusStr);
        }

        // Validate state transition
        Set<Campaign.Status> allowed = ALLOWED_TRANSITIONS.getOrDefault(oldStatus, Set.of());
        if (!allowed.contains(newStatus)) {
            throw new IllegalStateException(
                    String.format("Cannot transition from %s to %s", oldStatus, newStatus)
            );
        }

        campaign.setStatus(newStatus);
        campaign = campaignRepository.save(campaign);
        log.info("Campaign status changed: id={} userId={} {} -> {}", campaignId, userId, oldStatus, newStatus);
        return toCampaignDto(campaign);
    }

    @Override
    public void deleteCampaign(UUID userId, Long campaignId) {
        Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                .orElseThrow(() -> {
                    log.warn("Campaign not found or access denied: id={} userId={}", campaignId, userId);
                    return new AccessDeniedException("Not the owner of this campaign");
                });

        campaignRepository.delete(campaign);
        log.info("Campaign deleted: id={} userId={} name={}", campaignId, userId, campaign.getName());
    }

    // ============ Helpers =============

    private CampaignDto toCampaignDto(Campaign c) {
        return new CampaignDto(
                c.getId(),
                c.getName(),
                c.getStatus().name(),
                c.getStartDate(),
                c.getEndDate(),
                c.getChannel().name(),
                c.getDescription()
        );
    }
}
