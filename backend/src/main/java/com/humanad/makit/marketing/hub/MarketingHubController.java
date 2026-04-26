package com.humanad.makit.marketing.hub;

import com.humanad.makit.audit.Auditable;
import com.humanad.makit.marketing.hub.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/marketing")
@RequiredArgsConstructor
@Tag(name = "marketing-hub")
public class MarketingHubController {

    private final MarketingHubService hubService;

    @GetMapping("/hub")
    @Operation(summary = "Get marketing hub summary for authenticated user")
    public ResponseEntity<HubSummaryResponse> hub() {
        UUID userId = extractUserId();
        HubSummaryResponse response = hubService.getSummary(userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/campaigns")
    @Operation(summary = "List campaigns with optional status filter")
    public ResponseEntity<List<CampaignDto>> campaigns(
            @RequestParam(required = false) String status) {
        UUID userId = extractUserId();
        List<CampaignDto> campaigns = hubService.listCampaigns(userId, status);
        return ResponseEntity.ok(campaigns);
    }

    @GetMapping("/contents")
    @Operation(summary = "List recent contents with limit")
    public ResponseEntity<List<ContentDto>> contents(
            @RequestParam(defaultValue = "12") int limit) {
        UUID userId = extractUserId();
        int safeLim = Math.min(50, limit);
        List<ContentDto> contents = hubService.listRecentContents(userId, safeLim);
        return ResponseEntity.ok(contents);
    }

    @GetMapping("/calendar/week")
    @Operation(summary = "Get week calendar with campaign and content counts")
    public ResponseEntity<List<CalendarBucket>> calendarWeek() {
        UUID userId = extractUserId();
        List<CalendarBucket> calendar = hubService.getWeekCalendar(userId);
        return ResponseEntity.ok(calendar);
    }

    @GetMapping("/channels/performance")
    @Operation(summary = "Get channel performance metrics for specified days")
    public ResponseEntity<List<ChannelPerformance>> channelPerformance(
            @RequestParam(defaultValue = "30") int days) {
        UUID userId = extractUserId();
        int safeDays = Math.min(90, days);
        List<ChannelPerformance> performance = hubService.getChannelPerformance(userId, safeDays);
        return ResponseEntity.ok(performance);
    }

    // ============ Content CRUD =============

    @PostMapping("/contents")
    @Operation(summary = "Create a new content")
    @Auditable(resource = "marketing-content", action = "CREATE")
    public ResponseEntity<ContentDto> createContent(
            @Valid @RequestBody ContentCreateRequest req) {
        UUID userId = extractUserId();
        ContentDto dto = hubService.createContent(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/contents/{id}")
    @Operation(summary = "Get a specific content by ID")
    public ResponseEntity<ContentDto> getContent(@PathVariable Long id) {
        UUID userId = extractUserId();
        ContentDto dto = hubService.getContent(userId, id);
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/contents/{id}")
    @Operation(summary = "Update a content")
    @Auditable(resource = "marketing-content", action = "UPDATE")
    public ResponseEntity<ContentDto> updateContent(
            @PathVariable Long id,
            @Valid @RequestBody ContentUpdateRequest req) {
        UUID userId = extractUserId();
        ContentDto dto = hubService.updateContent(userId, id, req);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/contents/{id}")
    @Operation(summary = "Delete a content")
    @Auditable(resource = "marketing-content", action = "DELETE")
    public ResponseEntity<Void> deleteContent(@PathVariable Long id) {
        UUID userId = extractUserId();
        hubService.deleteContent(userId, id);
        return ResponseEntity.noContent().build();
    }

    // ============ Campaign CRUD =============

    @PostMapping("/campaigns")
    @Operation(summary = "Create a new campaign")
    @Auditable(resource = "marketing-campaign", action = "CREATE")
    public ResponseEntity<CampaignDto> createCampaign(
            @Valid @RequestBody CampaignCreateRequest req) {
        UUID userId = extractUserId();
        CampaignDto dto = hubService.createCampaign(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/campaigns/{id}")
    @Operation(summary = "Get a specific campaign by ID")
    public ResponseEntity<CampaignDto> getCampaign(@PathVariable Long id) {
        UUID userId = extractUserId();
        CampaignDto dto = hubService.getCampaign(userId, id);
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/campaigns/{id}")
    @Operation(summary = "Update a campaign")
    @Auditable(resource = "marketing-campaign", action = "UPDATE")
    public ResponseEntity<CampaignDto> updateCampaign(
            @PathVariable Long id,
            @Valid @RequestBody CampaignUpdateRequest req) {
        UUID userId = extractUserId();
        CampaignDto dto = hubService.updateCampaign(userId, id, req);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/campaigns/{id}/status")
    @Operation(summary = "Change campaign status")
    @Auditable(resource = "marketing-campaign", action = "STATUS_CHANGE")
    public ResponseEntity<CampaignDto> changeCampaignStatus(
            @PathVariable Long id,
            @Valid @RequestBody CampaignStatusChangeRequest req) {
        UUID userId = extractUserId();
        CampaignDto dto = hubService.changeCampaignStatus(userId, id, req);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/campaigns/{id}")
    @Operation(summary = "Delete a campaign")
    @Auditable(resource = "marketing-campaign", action = "DELETE")
    public ResponseEntity<Void> deleteCampaign(@PathVariable Long id) {
        UUID userId = extractUserId();
        hubService.deleteCampaign(userId, id);
        return ResponseEntity.noContent().build();
    }

    private UUID extractUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String userId = auth.getName();
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            log.error("Invalid user ID in authentication: {}", userId);
            throw new RuntimeException("Invalid user ID", e);
        }
    }
}
