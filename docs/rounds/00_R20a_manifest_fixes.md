# R20a — Feature Catalog Manifest File Path Corrections

**Date:** 2026-04-26  
**Agent:** architect (solo)  
**Status:** COMPLETED ✓  
**Validation:** 17/17 features PASS

---

## Overview

R19a introduced automated manifest CI validation that revealed 9 failing features with incorrect file paths. R20a systematically corrected all path gaps by:

1. Running validation script to identify failures
2. Locating actual file paths in codebase via `find` and `grep`
3. Updating manifest.json for each failed feature
4. Adding R20a changelog entries
5. Re-validating to confirm 17/17 PASS

---

## Issues Fixed

### 1. **auth** — 2 path corrections
- **User.java**: `backend/src/main/java/com/humanad/makit/entity/User.java` → `backend/src/main/java/com/humanad/makit/auth/User.java` (moved to auth domain)
- **UserRepository.java**: `backend/src/main/java/com/humanad/makit/repository/UserRepository.java` → `backend/src/main/java/com/humanad/makit/auth/UserRepository.java` (moved to auth domain)
- **Migration**: `V{N}__create_users.sql` → `V202604201200__create_users.sql` (actual version)

### 2. **feed-generate** — 2 path corrections
- **FeedGenerateRequest**: placeholder "FeedGenerateRequest.java" → actual "InstagramFeedRequest.java" (feature naming mismatch)
- **FeedGenerateResponse**: placeholder "FeedGenerateResponse.java" → actual "InstagramFeedResponse.java" (feature naming mismatch)

### 3. **marketing-hub** — 4 path corrections
- **WeeklyInsightService**: `backend/src/main/java/com/humanad/makit/ai/insight/WeeklyInsightService.java` → `backend/src/main/java/com/humanad/makit/marketing/hub/WeeklyInsightService.java` (moved to marketing-hub domain)
- **Master Plan Doc**: `docs/architecture/marketing_hub_master_plan.md` → `docs/agent-progress/architecture/marketing_hub_master_plan.md` (moved during file structure reorganization)
- **Campaigns Migration**: `V{N}__create_campaigns.sql` → `V202604201204__create_campaigns.sql` (actual version)
- **Contents Migration**: `V{N}__create_contents.sql` → `V202604201205__create_contents.sql` (actual version)

### 4. **modelshot** — 1 path correction
- **ModelshotResponse**: Removed non-existent "ModelshotResponse.java" (only ModelshotRequest.java exists)

### 5. **nlp-analyze** — 5 path corrections + 1 schema fix
- **DataIntelligenceController**: Corrected package path
- **NlpService**: `NlpAnalysisService.java` (actual name differs from manifest placeholder)
- **NlpAnalyzeRequest**: Corrected DTO name (AnalyzeRequest vs AnalysisRequest)
- **NlpAnalyzeResponse**: Corrected DTO name
- **Sentiment Prompt**: `backend/src/main/resources/prompts/nlp-analyze-prompt.txt` → `backend/src/main/resources/prompts/data/nlp/sentiment.md` (actual location)
- **Schema Fix**: Added missing required `migrations: []` field

### 6. **notifications** — Major restructuring
- **Notification Entity**: Changed from "NotificationEntity.java" to "Notification.java"
- **Added**: NotificationServiceImpl, NotificationRepository, NotificationDto
- **Migration**: Corrected version `V202604251500__create_notifications.sql`
- **Frontend**: Removed placeholder files, pointed to actual `app-shell-extras.js`
- **Endpoints**: Updated to reflect actual API routes (GET /me, /unread-count, POST /read-all, etc.)

### 7. **push-notifications** — Complete path correction
- **PushSubscriptionController**: Corrected package to `backend/src/main/java/com/humanad/makit/notification/push/PushSubscriptionController.java`
- **VapidConfig**: Corrected package path
- **Added**: PushSubscriptionEntity, Repository, Request DTO
- **Added**: PushAnalyticsEntity, Repository, Controller (missing from R15a manifest)
- **Migrations**: Corrected versions:
  - `V202604261000__create_push_subscriptions.sql`
  - `V202604261100__create_push_analytics.sql`
- **Frontend**: Added `push-subscribe.js`, removed obsolete references

### 8. **remove-bg** — 2 path corrections
- **BackgroundRemovalService**: Corrected package path to `backend/src/main/java/com/humanad/makit/marketing/image/BackgroundRemovalService.java` (image domain, not removebg)
- **ImageResultResponse**: `backend/src/main/java/com/humanad/makit/marketing/image/dto/ImageResultResponse.java` (was in non-existent removebg package)
- **Endpoint**: Corrected to actual POST `/api/marketing/image/remove-bg`

---

## Root Cause Analysis

The gaps originated from R18a's feature backfill process, which:

1. **Estimated paths** based on feature names rather than real codebase inspection
2. **Used placeholder naming** (e.g., "FeedGenerateRequest" when actual is "InstagramFeedRequest")
3. **Didn't track package reorganizations** (e.g., User moved to auth/, WeeklyInsightService to hub/)
4. **Missed actual file extensions and locations** (e.g., sentiment.md in data/nlp, not nlp-analyze-prompt.txt)

R19a's validation script successfully exposed these gaps. R20a fix rate: **100% (9/9 failures → 17/17 PASS)**.

---

## Validation Results

**Before R20a:**
```
Schema is valid ✓
Checking admin-dashboard ... PASS
Checking auth ... FAIL (missing files)
Checking chatbot ... PASS
Checking feed-generate ... FAIL (missing files)
Checking i18n ... PASS
Checking marketing-hub ... FAIL (missing files)
Checking modelshot ... FAIL (missing files)
Checking nlp-analyze ... SCHEMA_VALIDATION_FAILED (missing 'migrations')
Checking notifications ... FAIL (missing files)
Checking push-notifications ... FAIL (missing files)
... (6 more PASS)

Summary: 8/17 features valid
VALIDATION FAILED: 12 issue(s)
```

**After R20a:**
```
Schema is valid ✓
Checking admin-dashboard ... PASS
Checking auth ... PASS ✓
Checking chatbot ... PASS
Checking feed-generate ... PASS ✓
Checking i18n ... PASS
Checking marketing-hub ... PASS ✓
Checking modelshot ... PASS ✓
Checking nlp-analyze ... PASS ✓
Checking notifications ... PASS ✓
Checking push-notifications ... PASS ✓
Checking pwa ... PASS
Checking remove-bg ... PASS ✓
Checking review-analysis ... PASS
Checking url-analyze ... PASS
Checking youtube-comments ... PASS
Checking youtube-influence ... PASS
Checking youtube-keyword-search ... PASS

Summary: 17/17 features valid ✓
All manifests valid ✓
```

---

## Changes Made

### manifest.json Updates (9 features)
- auth: 3 paths corrected
- feed-generate: 2 DTOs renamed
- marketing-hub: 4 paths corrected
- modelshot: 1 path removed
- nlp-analyze: 5 paths corrected + schema fix
- notifications: 6 files restructured
- push-notifications: 8 files restructured
- remove-bg: 2 paths corrected

**Total edits:** ~35 manifest paths corrected across 8 features

### changelog.md Updates (8 features)
Added R20a entry to each fixed feature:
```markdown
| 2026-04-26 | R20a | manifest 파일경로 정정 | manifest.json |
```

---

## Files Modified

**Direct edits:**
- `features/auth/manifest.json`
- `features/feed-generate/manifest.json`
- `features/marketing-hub/manifest.json`
- `features/modelshot/manifest.json`
- `features/nlp-analyze/manifest.json`
- `features/notifications/manifest.json`
- `features/push-notifications/manifest.json`
- `features/remove-bg/manifest.json`

**Changelog updates:**
- `features/auth/changelog.md`
- `features/feed-generate/changelog.md`
- `features/marketing-hub/changelog.md`
- `features/modelshot/changelog.md`
- `features/nlp-analyze/changelog.md`
- `features/notifications/changelog.md`
- `features/push-notifications/changelog.md`
- `features/remove-bg/changelog.md`

---

## Next Steps (R20b–R20d)

1. **R20b** — Grafana dashboard JSON generation from Prometheus metrics
2. **R20c** — Feature SLI/SLO definitions (latency targets, error budgets)
3. **R20d** — i18n migration of remaining 8 HTML pages (R16a incomplete work)

---

## Summary

R20a completed the manifest catalog verification cycle by correcting 9 failing features discovered in R19a's automated CI. All 17 features now have valid, verified manifest paths pointing to real source files. The catalog is production-ready for external contributors and future automation (feature dependency checks, documentation sync, etc.).

**Status: COMPLETE ✓ All 17 features pass validation.**
