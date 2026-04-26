# R15b: Job Lifecycle Notification Triggers

## Overview

This round integrates notification triggers into the job execution lifecycle, enabling users to receive real-time feedback on asynchronous background work. Users are now notified when long-running jobs (modelshot generation, feed generation) transition through PENDING → RUNNING → SUCCESS/FAILED states.

## Architecture Analysis

### Job System Architecture
- **JobExecution entity** (backend/src/main/java/com/humanad/makit/job/JobExecution.java): Represents a background job with status (PENDING, RUNNING, SUCCESS, FAILED), input/output payloads (JSONB), error messages, and timestamps.
- **JobStatus enum** (backend/src/main/java/com/humanad/makit/job/JobStatus.java): Four states — PENDING (initial), RUNNING (async execution started), SUCCESS (completion with output), FAILED (completion with error).
- **JobService** (backend/src/main/java/com/humanad/makit/job/JobService.java): Business logic layer with four public methods:
  - `create(userId, domain, operation, input)` — Creates a PENDING job for later async execution
  - `markRunning(jobId)` — Called when async executor starts processing (PENDING → RUNNING)
  - `markSuccess(jobId, output)` — Called when task completes successfully with result payload (RUNNING → SUCCESS)
  - `markFailed(jobId, errorMessage)` — Called when task fails with error detail (RUNNING → FAILED)

### Current Callers (Job Producers)
1. **ModelshotService** (backend/src/main/java/com/humanad/makit/commerce/modelshot/ModelshotService.java)
   - `generate(req, userId)` creates a job, executes async via `aiExecutor` thread pool
   - Calls `markRunning()`, `markSuccess(jobId, imageUrl + mimeType)`, or `markFailed(jobId, errorMsg)` in try/catch pattern
   - Estimated duration: 5-30 seconds (image generation via Bedrock)

2. **FeedGenerationService** (backend/src/main/java/com/humanad/makit/marketing/feed/FeedGenerationService.java)
   - `generate(req, userId)` creates a job only if `includeImage=true`; otherwise returns synchronous response
   - Async path calls `markRunning()`, `markSuccess(jobId, caption + hashtags + imageUrl)`, or `markFailed(jobId, errorMsg)`
   - Estimated duration: 5-20 seconds (text + optional image generation via Bedrock)

### Notification Service Integration
- **NotificationService.create(userId, type, title, message, linkUrl)** interface (already in place from R13)
  - Creates persistent Notification entity in DB
  - Pushes via WebSocket to user's browser in real-time
  - Optionally pushes via VAPID Web Push (from R14c) if user is offline
  - Gracefully handles failures — notification failure never blocks job execution
- **Type/Severity**: INFO (job started), SUCCESS (job completed), ERROR (job failed)
- **Pattern established in R13/R14a**: Always wrap notification calls in try/catch with log.warn to prevent side-effect failures

## Changes Made

### Modified Files

#### 1. **JobService.java**
**Location**: backend/src/main/java/com/humanad/makit/job/JobService.java

**Changes**:
- Added import: `com.humanad.makit.notification.NotificationService`
- Added imports: `lombok.extern.slf4j.Slf4j`, `@Slf4j` class annotation
- Injected `NotificationService notificationService` via `@RequiredArgsConstructor`
- **markRunning(UUID jobId)**: 
  - Extracts service key from operation (e.g., "modelshot" from "modelshot.generate")
  - Calls `notificationService.create(userId, "INFO", "작업이 시작되었습니다", serviceName, null)`
  - Wrapped in try/catch with `log.warn` fallback
- **markSuccess(UUID jobId, Map<String, Object> output)**:
  - Calls `notificationService.create(userId, "SUCCESS", "작업이 완료되었습니다", serviceName, null)`
  - Wrapped in try/catch with `log.warn` fallback
- **markFailed(UUID jobId, String errorMessage)**:
  - Truncates error message to 100 chars to prevent bloated notification body
  - Calls `notificationService.create(userId, "ERROR", "작업이 실패했습니다", serviceName + " - " + errorPreview, null)`
  - Wrapped in try/catch with `log.warn` fallback
- **New private method mapServiceKeyToName(String serviceKey)**:
  - Maps operation keys to Korean service names:
    - "modelshot" → "모델컷 생성"
    - "feed" → "인스타그램 피드 생성"
    - "nlp-analyze" → "자연어 분석"
    - "youtube-*" → "유튜브 분석"
    - "remove-bg" → "배경 제거"
    - "chatbot" → "AI 챗봇"
    - "review-analysis" → "리뷰 분석"
    - "url-analyze" → "URL 분석"
    - default → "작업"

**Impact**: Existing callers (ModelshotService, FeedGenerationService) require zero changes. They call the same `markRunning/markSuccess/markFailed` methods, which now emit notifications as a side effect.

## Verification Checklist

✅ **Imports**: All new imports (NotificationService, Slf4j) are correct and follow existing patterns.
✅ **Notification wrapping**: All three notification calls (RUNNING/SUCCESS/FAILED) are individually wrapped in try/catch + log.warn to prevent job execution interruption.
✅ **Service key mapping**: Korean names cover all 10 service keys used in the codebase (data intelligence, marketing, commerce domains) + sensible default.
✅ **Message format**: Korean titles + service-name descriptions, consistent with R13/R14a patterns.
✅ **No schema changes**: JobExecution entity and JobStatus enum unchanged; no database migration required.
✅ **No new dependencies**: Uses existing NotificationService, no additional libraries.
✅ **Backward compatibility**: Existing callers (ModelshotService, FeedGenerationService) unaffected; notification is injected transparently.

## User Experience Impact

**Before R15b**: Users initiate a long-running job (e.g., "Generate Instagram feed with image") and receive only an HTTP 202 Accepted response with a job ID. They must manually poll the job endpoint (/api/marketing/jobs/{jobId}) to check status. No real-time feedback.

**After R15b**: Users receive three notifications:
1. **Job started** (INFO badge, bell icon): "작업이 시작되었습니다" — "인스타그램 피드 생성" → Immediate acknowledgment that work began
2. **Job completed** (SUCCESS badge): "작업이 완료되었습니다" — "인스타그램 피드 생성" → Signals ready to download/view result
3. **Job failed** (ERROR badge): "작업이 실패했습니다" — "인스타그램 피드 생성 - Connection timeout" → Explains what went wrong

Notifications appear in:
- Real-time bell icon badge in top-right (R5 notification center)
- WebSocket push message if tab is open (R13)
- OS-level push if subscribed to Web Push notifications (R14c)

## Next Steps

Potential future enhancements:
- **Notification persistence**: Link notifications to job IDs for job-specific notification history
- **Selective notification**: User settings to opt-in/out of job notifications
- **Job polling optimization**: Use Server-Sent Events (SSE) instead of HTTP polling for long-running jobs
- **Job cancellation**: Add JobStatus.CANCELLED state and `markCancelled(jobId)` method with notification trigger
- **Job progress tracking**: Add progress percentage to JobExecution (estimated %, current %) for intermediate notifications

## Files Modified

1. `backend/src/main/java/com/humanad/makit/job/JobService.java` — Added notification triggers to markRunning, markSuccess, markFailed + service-key-to-name mapping

## Conclusion

R15b completes the job lifecycle notification integration without database schema changes or new dependencies. Users now have real-time visibility into asynchronous job execution state transitions (RUNNING/SUCCESS/FAILED), enabling a more responsive and transparent experience for long-running AI operations.
