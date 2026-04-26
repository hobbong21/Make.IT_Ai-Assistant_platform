package com.humanad.makit.marketing.hub;

import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.marketing.campaign.Campaign;
import com.humanad.makit.marketing.campaign.CampaignRepository;
import com.humanad.makit.marketing.content.Content;
import com.humanad.makit.marketing.content.ContentRepository;
import com.humanad.makit.marketing.hub.dto.*;
import com.humanad.makit.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketingHubServiceImpl implements MarketingHubService {

    private final CampaignRepository campaignRepository;
    private final ContentRepository contentRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationService notificationService;

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
            Map<String, List<DailyMetric>> channelMetrics = new HashMap<>();
            channelMetrics.put("INSTAGRAM", new ArrayList<>());
            channelMetrics.put("YOUTUBE", new ArrayList<>());
            channelMetrics.put("SEO", new ArrayList<>());
            channelMetrics.put("ADS", new ArrayList<>());

            LocalDate today = LocalDate.now();
            for (String channel : channelMetrics.keySet()) {
                for (int i = 0; i < days; i++) {
                    LocalDate date = today.minusDays(days - 1 - i);
                    channelMetrics.get(channel).add(new DailyMetric(date, 0L));
                }
            }

            List<Object[]> results = auditLogRepository.findChannelMetricsByDay(userId, days);
            
            for (Object[] row : results) {
                String day = (String) row[0];
                String serviceKey = (String) row[1];
                Long count = ((Number) row[2]).longValue();

                String channel = mapServiceKeyToChannel(serviceKey);
                LocalDate date = LocalDate.parse(day);

                List<DailyMetric> series = channelMetrics.get(channel);
                for (int i = 0; i < series.size(); i++) {
                    if (series.get(i).date().equals(date)) {
                        series.set(i, new DailyMetric(date, count));
                        break;
                    }
                }
            }

            List<ChannelPerformance> performance = new ArrayList<>();
            for (String channel : new String[]{"INSTAGRAM", "YOUTUBE", "SEO", "ADS"}) {
                List<DailyMetric> series = channelMetrics.get(channel);
                long total = series.stream().mapToLong(DailyMetric::value).sum();
                double avg = total > 0 ? (double) total / days : 0.0;
                performance.add(new ChannelPerformance(channel, series, total, avg));
            }

            return performance;
        } catch (Exception e) {
            log.warn("Error fetching channel performance for user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ============ Content CRUD =============

    @Override
    @Transactional
    public ContentDto createContent(UUID userId, ContentCreateRequest req) {
        try {
            Content content = new Content();
            content.setUserId(userId);
            content.setTitle(req.title());
            content.setType(req.type());
            content.setImageUrl(req.thumbnailUrl());
            content.setBody(req.body());
            content.setStatus(Content.Status.DRAFT);

            Content saved = contentRepository.save(content);
            log.info("Content created: id={}, userId={}, title={}", saved.getId(), userId, saved.getTitle());

            // Send notification to user
            try {
                notificationService.create(
                    userId,
                    "INFO",
                    "새 콘텐츠 추가",
                    String.format("새 콘텐츠 '%s'이(가) 라이브러리에 추가되었습니다", saved.getTitle()),
                    null
                );
            } catch (Exception notifEx) {
                log.warn("Failed to send notification for content creation: {}", notifEx.getMessage());
                // Continue anyway - content creation must not be blocked by notification failure
            }

            return new ContentDto(
                saved.getId(),
                saved.getTitle(),
                saved.getType(),
                saved.getImageUrl(),
                saved.getCreatedAt(),
                req.serviceKey()
            );
        } catch (Exception e) {
            log.error("Error creating content for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to create content", e);
        }
    }

    @Override
    public ContentDto getContent(UUID userId, Long contentId) {
        try {
            Content content = contentRepository.findByIdAndUserId(contentId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Content not found or access denied"));
            
            return new ContentDto(
                content.getId(),
                content.getTitle(),
                content.getType(),
                content.getImageUrl(),
                content.getCreatedAt(),
                "unknown"
            );
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching content {} for user {}: {}", contentId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch content", e);
        }
    }

    @Override
    @Transactional
    public ContentDto updateContent(UUID userId, Long contentId, ContentUpdateRequest req) {
        try {
            Content content = contentRepository.findByIdAndUserId(contentId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Content not found or access denied"));
            
            if (req.title() != null) content.setTitle(req.title());
            if (req.type() != null) content.setType(req.type());
            if (req.thumbnailUrl() != null) content.setImageUrl(req.thumbnailUrl());
            if (req.body() != null) content.setBody(req.body());
            
            Content updated = contentRepository.save(content);
            log.info("Content updated: id={}, userId={}", updated.getId(), userId);
            
            return new ContentDto(
                updated.getId(),
                updated.getTitle(),
                updated.getType(),
                updated.getImageUrl(),
                updated.getCreatedAt(),
                req.serviceKey()
            );
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error updating content {} for user {}: {}", contentId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to update content", e);
        }
    }

    @Override
    @Transactional
    public void deleteContent(UUID userId, Long contentId) {
        try {
            Content content = contentRepository.findByIdAndUserId(contentId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Content not found or access denied"));

            String contentTitle = content.getTitle();
            contentRepository.delete(content);
            log.info("Content deleted: id={}, userId={}", contentId, userId);

            // Send notification to user
            try {
                notificationService.create(
                    userId,
                    "WARN",
                    "콘텐츠 삭제됨",
                    String.format("콘텐츠 '%s'이(가) 삭제되었습니다", contentTitle),
                    null
                );
            } catch (Exception notifEx) {
                log.warn("Failed to send notification for content deletion: {}", notifEx.getMessage());
                // Continue anyway - content deletion must not be blocked by notification failure
            }
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error deleting content {} for user {}: {}", contentId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to delete content", e);
        }
    }

    // ============ Campaign CRUD =============

    @Override
    @Transactional
    public CampaignDto createCampaign(UUID userId, CampaignCreateRequest req) {
        try {
            Campaign campaign = new Campaign();
            campaign.setUserId(userId);
            campaign.setName(req.name());
            campaign.setDescription(req.description());
            campaign.setChannel(Campaign.Channel.valueOf(req.channel().toUpperCase()));
            campaign.setStartDate(req.startDate());
            campaign.setEndDate(req.endDate());
            campaign.setStatus(Campaign.Status.DRAFT);

            Campaign saved = campaignRepository.save(campaign);
            log.info("Campaign created: id={}, userId={}, name={}, channel={}",
                saved.getId(), userId, saved.getName(), saved.getChannel());

            // Send notification to user
            try {
                notificationService.create(
                    userId,
                    "INFO",
                    "캠페인이 생성되었습니다",
                    String.format("캠페인 '%s' (%s)이(가) 생성되었습니다", saved.getName(), saved.getChannel()),
                    null
                );
            } catch (Exception notifEx) {
                log.warn("Failed to send notification for campaign creation: {}", notifEx.getMessage());
                // Continue anyway - campaign creation must not be blocked by notification failure
            }

            return toCampaignDto(saved);
        } catch (Exception e) {
            log.error("Error creating campaign for user {}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Failed to create campaign", e);
        }
    }

    @Override
    public CampaignDto getCampaign(UUID userId, Long campaignId) {
        try {
            Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Campaign not found or access denied"));

            return toCampaignDto(campaign);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error fetching campaign {} for user {}: {}", campaignId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to fetch campaign", e);
        }
    }

    @Override
    @Transactional
    public CampaignDto updateCampaign(UUID userId, Long campaignId, CampaignUpdateRequest req) {
        try {
            Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Campaign not found or access denied"));

            if (req.name() != null) campaign.setName(req.name());
            if (req.description() != null) campaign.setDescription(req.description());
            if (req.channel() != null) campaign.setChannel(Campaign.Channel.valueOf(req.channel().toUpperCase()));
            if (req.startDate() != null) campaign.setStartDate(req.startDate());
            if (req.endDate() != null) campaign.setEndDate(req.endDate());

            Campaign updated = campaignRepository.save(campaign);
            log.info("Campaign updated: id={}, userId={}", updated.getId(), userId);

            return toCampaignDto(updated);
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error updating campaign {} for user {}: {}", campaignId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to update campaign", e);
        }
    }

    @Override
    @Transactional
    public CampaignDto changeCampaignStatus(UUID userId, Long campaignId, CampaignStatusChangeRequest req) {
        try {
            Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Campaign not found or access denied"));

            Campaign.Status newStatus = Campaign.Status.valueOf(req.status().toUpperCase());
            Campaign.Status currentStatus = campaign.getStatus();

            // Validate state transition
            Set<Campaign.Status> allowedTransitions = ALLOWED_TRANSITIONS.getOrDefault(currentStatus, Set.of());
            if (!allowedTransitions.contains(newStatus)) {
                throw new IllegalStateException(
                    String.format("Cannot transition from %s to %s", currentStatus, newStatus)
                );
            }

            campaign.setStatus(newStatus);
            Campaign updated = campaignRepository.save(campaign);
            log.info("Campaign status changed: id={}, userId={}, from={}, to={}",
                updated.getId(), userId, currentStatus, newStatus);

            // Send notification based on status transition
            try {
                String notifType = "INFO";
                String notifTitle = "캠페인 상태 변경";
                String notifMessage = String.format("캠페인 '%s'의 상태가 %s로 변경되었습니다",
                    updated.getName(), newStatus);

                if (currentStatus == Campaign.Status.DRAFT && newStatus == Campaign.Status.SCHEDULED) {
                    notifType = "INFO";
                    notifTitle = "캠페인 예약됨";
                    notifMessage = String.format("캠페인 '%s'이(가) 예약되었습니다", updated.getName());
                } else if (currentStatus == Campaign.Status.SCHEDULED && newStatus == Campaign.Status.ACTIVE) {
                    notifType = "SUCCESS";
                    notifTitle = "캠페인 시작됨";
                    notifMessage = String.format("캠페인 '%s'이(가) 시작되었습니다", updated.getName());
                } else if (currentStatus == Campaign.Status.ACTIVE && newStatus == Campaign.Status.PAUSED) {
                    notifType = "WARN";
                    notifTitle = "캠페인 일시정지";
                    notifMessage = String.format("캠페인 '%s'이(가) 일시정지되었습니다", updated.getName());
                } else if ((currentStatus == Campaign.Status.ACTIVE || currentStatus == Campaign.Status.PAUSED)
                           && newStatus == Campaign.Status.COMPLETED) {
                    notifType = "SUCCESS";
                    notifTitle = "캠페인 완료";
                    notifMessage = String.format("캠페인 '%s'이(가) 완료되었습니다", updated.getName());
                } else if (newStatus == Campaign.Status.ARCHIVED) {
                    notifType = "INFO";
                    notifTitle = "캠페인 보관됨";
                    notifMessage = String.format("캠페인 '%s'이(가) 보관되었습니다", updated.getName());
                }

                notificationService.create(userId, notifType, notifTitle, notifMessage, null);
            } catch (Exception notifEx) {
                log.warn("Failed to send notification for campaign status change: {}", notifEx.getMessage());
                // Continue anyway - status change must not be blocked by notification failure
            }

            return toCampaignDto(updated);
        } catch (AccessDeniedException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error changing campaign status {} for user {}: {}", campaignId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to change campaign status", e);
        }
    }

    @Override
    @Transactional
    public void deleteCampaign(UUID userId, Long campaignId) {
        try {
            Campaign campaign = campaignRepository.findByIdAndUserId(campaignId, userId)
                    .orElseThrow(() -> new AccessDeniedException("Campaign not found or access denied"));

            String campaignName = campaign.getName();
            campaignRepository.delete(campaign);
            log.info("Campaign deleted: id={}, userId={}", campaignId, userId);

            // Send notification to user
            try {
                notificationService.create(
                    userId,
                    "WARN",
                    "캠페인이 삭제되었습니다",
                    String.format("캠페인 '%s'이(가) 삭제되었습니다", campaignName),
                    null
                );
            } catch (Exception notifEx) {
                log.warn("Failed to send notification for campaign deletion: {}", notifEx.getMessage());
                // Continue anyway - campaign deletion must not be blocked by notification failure
            }
        } catch (AccessDeniedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error deleting campaign {} for user {}: {}", campaignId, userId, e.getMessage(), e);
            throw new RuntimeException("Failed to delete campaign", e);
        }
    }

    private String mapServiceKeyToChannel(String serviceKey) {
        if (serviceKey == null) return "ADS";
        if (serviceKey.startsWith("youtube-")) return "YOUTUBE";
        if (serviceKey.equals("feed-generate") || serviceKey.equals("remove-bg") ||
            serviceKey.equals("modelshot")) return "INSTAGRAM";
        if (serviceKey.equals("nlp-analyze") || serviceKey.equals("url-analyze")) return "SEO";
        return "ADS";
    }

    private CampaignDto toCampaignDto(Campaign c) {
        return new CampaignDto(
            c.getId(),
            c.getName(),
            c.getStatus().toString(),
            c.getStartDate(),
            c.getEndDate(),
            c.getChannel().toString(),
            c.getDescription()
        );
    }
}
