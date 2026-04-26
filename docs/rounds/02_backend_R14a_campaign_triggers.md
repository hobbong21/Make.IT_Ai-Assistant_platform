# R14a: Campaign CRUD Notification Triggers

## Scope
Added NotificationService.create() calls to Campaign lifecycle events in the MaKIT backend. This extends the notification system (already integrated in R13 for Content CRUD and Auth lifecycle) to Campaign operations.

## Changes Made

### 1. MarketingHubService Interface
Added 5 new campaign CRUD method signatures:
- `createCampaign(UUID userId, CampaignCreateRequest req)`
- `getCampaign(UUID userId, Long campaignId)`
- `updateCampaign(UUID userId, Long campaignId, CampaignUpdateRequest req)`
- `changeCampaignStatus(UUID userId, Long campaignId, CampaignStatusChangeRequest req)`
- `deleteCampaign(UUID userId, Long campaignId)`

**File**: `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubService.java`

### 2. MarketingHubServiceImpl Implementation
Implemented all 5 campaign CRUD methods with embedded notification triggers:

#### createCampaign - Trigger: INFO "캠페인이 생성되었습니다"
- Wraps notificationService.create() in try/catch
- Sends campaign name + channel in message
- Continues if notification fails (graceful degradation)

#### changeCampaignStatus - Trigger: Severity depends on transition
- **DRAFT → SCHEDULED**: INFO "캠페인 예약됨"
- **SCHEDULED → ACTIVE**: SUCCESS "캠페인 시작됨"
- **ACTIVE → PAUSED**: WARN "캠페인 일시정지"
- **ACTIVE/PAUSED → COMPLETED**: SUCCESS "캠페인 완료"
- **any → ARCHIVED**: INFO "캠페인 보관됨"
- Implements complete state machine validation
- Notification failure does not block status transition

#### deleteCampaign - Trigger: WARN "캠페인이 삭제되었습니다"
- Captures campaign name before deletion
- Sends notification after successful deletion
- Fails safely if notification fails

#### updateCampaign - No notification (skipped to reduce noise)
- PATCH operations are frequent for minor changes
- Could be added later if needed

**File**: `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubServiceImpl.java`
**Lines added**: ~180 (includes 4 CRUD methods + notification wiring + state machine logic)

### 3. MarketingHubController Endpoints
Added 5 new REST endpoints with @Auditable annotation:

- `POST /api/marketing/campaigns` → createCampaign (201 Created, action=CREATE)
- `GET /api/marketing/campaigns/{id}` → getCampaign (200 OK)
- `PATCH /api/marketing/campaigns/{id}` → updateCampaign (200 OK, action=UPDATE)
- `POST /api/marketing/campaigns/{id}/status` → changeCampaignStatus (200 OK, action=STATUS_CHANGE)
- `DELETE /api/marketing/campaigns/{id}` → deleteCampaign (204 No Content, action=DELETE)

All endpoints extract userId from SecurityContext, enforce ownership via CampaignRepository.findByIdAndUserId(), and are decorated with @Auditable for audit logging.

**File**: `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubController.java`
**Lines added**: ~60

## Notification Pattern
Follows the existing content CRUD pattern from R13:

```java
try {
    notificationService.create(
        userId,
        "INFO",         // Type: INFO | SUCCESS | WARN | ERROR
        "Title",        // Korean title (50 chars max)
        "Message",      // Korean message with campaign name/channel details
        null            // linkUrl (unused in this round)
    );
} catch (Exception notifEx) {
    log.warn("Failed to send notification: {}", notifEx.getMessage());
    // Continue - business operation not blocked
}
```

## State Machine Validation
Enforces legal campaign status transitions:

- DRAFT → SCHEDULED, ACTIVE
- SCHEDULED → ACTIVE, DRAFT
- ACTIVE → PAUSED, COMPLETED
- PAUSED → ACTIVE, COMPLETED
- COMPLETED, ARCHIVED → (terminal states)

Illegal transitions throw IllegalStateException (400 BAD_REQUEST per GlobalExceptionHandler).

## Dependencies
- NotificationService: Already injected via @RequiredArgsConstructor
- CampaignRepository: Already exists with findByIdAndUserId()
- Campaign entity: Already has Status/Channel enums
- Request/Response DTOs: Already exist (CampaignCreateRequest, etc.)

## Verification
1. All 4 notification calls wrapped in try/catch with log.warn
2. Notification failure does not block business operations
3. All 5 endpoints use @Auditable for audit trail
4. Ownership verified via CampaignRepository.findByIdAndUserId()
5. State machine validation prevents illegal transitions
6. Korean messages follow existing naming conventions

## Files Modified
1. `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubService.java` - Interface
2. `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubServiceImpl.java` - Implementation with notifications
3. `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubController.java` - 5 new REST endpoints

## Notes for Next Rounds
- R14b (frontend): Update marketing-hub.js to call new campaign endpoints
- R14c (optional): Add job failure notifications if JobService.markFailed() is called
- D6 (design): Implement animation on notification toast (prefers-reduced-motion respected)
- PWA: VAPID push notification opt-in for notification persistence
