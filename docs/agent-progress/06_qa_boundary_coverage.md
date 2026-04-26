# MaKIT — QA Boundary Coverage Matrix

**Author**: qa-engineer
**Date**: 2026-04-20
**Purpose**: Transparency on what was and wasn't verified in the 2026-04-20 cross-comparison pass.

Legend: ✅ full cross-read / ⚪ referenced only (name/signature checked via index/progress log, body not opened) / ❌ skipped.

---

## Boundary 1 — Backend API ↔ Frontend

### Controllers (backend side)

| Controller | File | Status |
|---|---|---|
| AuthController | `backend/src/main/java/com/humanad/makit/auth/AuthController.java` | ✅ |
| DataIntelligenceController | `backend/src/main/java/com/humanad/makit/data/DataIntelligenceController.java` | ✅ |
| MarketingIntelligenceController | `backend/src/main/java/com/humanad/makit/marketing/MarketingIntelligenceController.java` | ✅ |
| CommerceBrainController | `backend/src/main/java/com/humanad/makit/commerce/CommerceBrainController.java` | ✅ |
| ChatbotStreamController | `backend/src/main/java/com/humanad/makit/commerce/chatbot/ChatbotStreamController.java` | ✅ |
| JobController | `backend/src/main/java/com/humanad/makit/job/JobController.java` | ✅ |
| HealthCheckController | `backend/src/main/java/com/humanad/makit/common/HealthCheckController.java` | ✅ |

### DTOs

| DTO | Status |
|---|---|
| LoginRequest / LoginResponse / UserDto / RegisterRequest / RefreshRequest | ✅ |
| NlpAnalyzeRequest / NlpAnalyzeResponse | ✅ |
| YoutubeCommentsRequest / Response | ⚪ (exist per glob; spot-checked; not re-read) |
| YoutubeInfluenceRequest / Response | ⚪ |
| YoutubeKeywordSearchRequest / Response | ⚪ |
| UrlAnalyzeRequest / Response | ⚪ |
| InstagramFeedRequest / Response | ✅ |
| ImageResultResponse | ⚪ |
| ChatMessageRequest / Response | ✅ |
| ChatStreamChunk | ✅ |
| ReviewAnalysisRequest / Response | ✅ |
| ModelshotRequest | ✅ |
| JobAcceptedResponse / JobStatusResponse | ✅ |
| ApiErrorResponse | ✅ |
| PageResponse | ⚪ |

### Frontend

| File | Status |
|---|---|
| `frontend/js/api.js` | ✅ |
| `frontend/js/config.js` | ✅ |
| `frontend/js/auth.js` | ✅ |
| `frontend/js/ui.js` | ⚪ |
| `frontend/js/pages/login.js` | ✅ |
| `frontend/js/pages/index.js` | ❌ (not in scope — FE reads auth/me only) |
| `frontend/js/pages/all-services.js` | ❌ (no API calls) |
| `frontend/js/pages/service-detail.js` | ✅ |
| `frontend/js/pages/chatbot.js` | ✅ |

### Endpoints covered in cross-read table

✅ /api/auth/login, /register, /me, /logout, /refresh
✅ /api/data/nlp/analyze, /youtube/comments, /youtube/influence, /url/analyze, /youtube/keyword-search
✅ /api/marketing/feed/generate, /image/remove-bg
✅ /api/commerce/chatbot/message, /chatbot/stream, /reviews/{productId}/analyze, /modelshot/generate
✅ /api/{data,marketing,commerce}/jobs/{jobId}
✅ /api/health
⚪ /actuator/health, /actuator/info (shape trivial)

---

## Boundary 2 — AI ↔ Backend

### Interfaces

| File | Status |
|---|---|
| `ai/ContentGenerationStrategy.java` | ✅ |
| `ai/ChatbotEngine.java` | ✅ |
| `ai/KnowledgeRetriever.java` | ⚪ (signature via retriever impl) |
| `ai/EmbeddingService.java` | ⚪ (signature via Titan impl) |

### Implementations (AI side)

| File | Status |
|---|---|
| `ai/content/ClaudeTextContentStrategy.java` | ✅ |
| `ai/content/StableDiffusionImageStrategy.java` | ✅ |
| `ai/content/S3ImageUploader.java` | ✅ |
| `ai/bedrock/BedrockProperties.java` | ✅ |
| `ai/bedrock/BedrockConfig.java` | ✅ |
| `ai/bedrock/BedrockClient.java` | ⚪ |
| `ai/bedrock/BedrockInvocation.java` | ⚪ |
| `ai/bedrock/BedrockInvocationException.java` | ⚪ |
| `ai/bedrock/BedrockService.java` | ✅ |
| `ai/bedrock/MockBedrockService.java` | ✅ |
| `ai/embedding/TitanEmbeddingService.java` | ✅ |
| `ai/rag/PgVectorKnowledgeRetriever.java` | ✅ |
| `ai/rag/TextChunker.java` | ❌ (chunker logic not critical to boundary) |
| `ai/rag/RAGChatbotEngine.java` | ✅ |
| `ai/prompt/PromptLoader.java` | ✅ |
| `ai/config/AsyncConfig.java` | ✅ |
| `ai/config/CacheConfig.java` | ✅ |

### Backend services consuming AI interfaces

| File | Status |
|---|---|
| `data/nlp/NlpAnalysisService.java` | ✅ |
| `data/url/UrlAnalysisService.java` | ✅ |
| `data/youtube/YoutubeCommentsService.java` | ✅ |
| `data/youtube/YoutubeInfluenceService.java` | ✅ |
| `data/youtube/YoutubeKeywordSearchService.java` | ❌ (stub — not cross-checked) |
| `marketing/feed/FeedGenerationService.java` | ✅ |
| `marketing/image/BackgroundRemovalService.java` | ✅ |
| `commerce/chatbot/ChatbotService.java` | ✅ |
| `commerce/modelshot/ModelshotService.java` | ✅ |
| `commerce/review/ReviewAnalysisService.java` | ✅ |

### AI DTOs

| File | Status |
|---|---|
| `ai/dto/ContentType.java` | ✅ |
| `ai/dto/TextGenerationRequest.java` | ✅ |
| `ai/dto/GeneratedContent.java` | ⚪ |
| `ai/dto/ImageGenerationRequest.java` | ⚪ |
| `ai/dto/ImageEditRequest.java` | ⚪ (via ModelshotService/BackgroundRemovalService usage) |
| `ai/dto/GeneratedImage.java` | ⚪ |
| `ai/dto/ChatRequest.java` | ✅ |
| `ai/dto/ChatResponse.java` | ✅ |
| `ai/dto/ChatStreamChunk.java` | ✅ |
| `ai/dto/ConversationContext.java` | ✅ |
| `ai/dto/ModelInfo.java` | ❌ |
| `ai/dto/RetrievedChunk.java` | ⚪ (via retriever result mapping) |
| `ai/dto/RetrievalOptions.java` | ⚪ |
| `ai/dto/KnowledgeDocumentRef.java` | ⚪ |

### Prompts (classpath resources)

- `prompts/data/nlp/sentiment.md`, `data/youtube/comment_cluster.md`, `data/url/seo_summary.md`, `marketing/instagram_caption.md`, `marketing/image_prompt.md`, `commerce/rag_system.md`, `commerce/review_sentiment.md`, `commerce/modelshot_prompt.md` — ⚪ existence per `03_ai_progress.md` manifest; contents not opened. Key-mapping vs backend references cross-checked → QA-004.

---

## Boundary 3 — DB ↔ Entity

### Migrations

| File | Status |
|---|---|
| `V00000001__init_extensions.sql` | ✅ |
| `V202604201200__create_users.sql` | ✅ |
| `V202604201201__create_audit_logs.sql` | ✅ |
| `V202604201202__create_conversation.sql` | ✅ |
| `V202604201203__create_knowledge.sql` | ✅ |
| `V202604201204__create_campaigns.sql` | ✅ |
| `V202604201205__create_contents.sql` | ✅ |
| `V202604201206__create_jobs.sql` | ✅ |
| `V202604201207__create_reviews.sql` | ✅ |
| `V202604201208__seed_demo_user.sql` | ✅ |

### Entities

| Entity | Status |
|---|---|
| `auth/User.java` + `UserRole.java` | ✅ |
| `audit/AuditLog.java` | ⚪ (per progress log; FK + fields not fully verified) |
| `commerce/chatbot/ConversationContext.java` | ✅ |
| `commerce/chatbot/ChatMessage.java` | ✅ |
| `commerce/knowledge/KnowledgeDocument.java` | ⚪ (existence confirmed; column-by-column match not checked) |
| `commerce/review/Review.java` | ⚪ (existence confirmed via service; field map not re-read) |
| `marketing/campaign/Campaign.java` | ✅ |
| `marketing/campaign/CampaignAnalytics.java` | ⚪ |
| `job/JobExecution.java` + `JobStatus.java` | ✅ |
| **Missing entity**: `contents` table — no JPA class | documented QA-M07 |
| **No JPA entity**: `knowledge_chunks` (by design — JdbcTemplate) | documented QA-005 |

---

## Boundary 4 — Docker ↔ Runtime

| File | Status |
|---|---|
| `docker-compose.yml` | ✅ |
| `docker-compose.override.yml` | ✅ |
| `backend/Dockerfile` | ✅ |
| `Dockerfile` (nginx/frontend) | ✅ |
| `.env.example` | ✅ |
| `.dockerignore` | ❌ (not in scope) |
| `.gitignore` | ❌ |
| `backend/src/main/resources/application.yml` | ✅ |
| `backend/src/main/resources/application-docker.yml` | ✅ |
| `backend/src/main/resources/application-prod.yml` | ✅ |
| `backend/src/main/resources/application-mock.yml` | ✅ |
| `scripts/setup.sh` | ⚪ (per devops progress summary; script body not opened) |
| `scripts/deploy-aws.sh` | ❌ |
| `.github/workflows/*.yml` | ❌ (CI not in scope of boot-smoke) |
| `_workspace/05_devops_iam_policies.md` | ❌ |
| `_workspace/05_devops_runbook.md` | ❌ |

### Env vars verified

- `SPRING_DATASOURCE_URL/USERNAME/PASSWORD` ✅
- `SPRING_REDIS_HOST/PORT` ✅
- `JWT_SECRET` ✅ (fail-fast confirmed)
- `AWS_REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY` ✅
- `S3_BUCKET` ✅
- `CORS_ALLOWED_ORIGINS` ✅ (QA-010 gap documented)
- `BEDROCK_TEXT_MODEL_ID/IMAGE_MODEL_ID` ✅ (QA-M11 — dead keys)
- `SPRING_PROFILES_ACTIVE` ✅

---

## Boundary 5 — Nginx ↔ Backend

| File | Status |
|---|---|
| `nginx.conf` | ✅ |
| `Dockerfile` (frontend nginx image) | ✅ |
| All backend `@RequestMapping` prefixes | ✅ (cross-read with boundary 1 controllers) |
| `SecurityConfig.java` (permitAll matchers) | ✅ |
| `CorsConfig.java` | ✅ |

### Routes verified

- `/healthz` ✅
- `/api/commerce/chatbot/stream` (exact-match location, SSE) ✅
- `/api/` generic proxy ✅
- `/swagger-ui.html`, `/v3/api-docs` ✅
- `/actuator/` ✅ (QA-M14 flagged)
- `/` SPA fallback ✅
- Static asset caching pattern ✅

---

## Not verified / explicitly out of scope

- Runtime behavior (`mvn verify`, `docker-compose up`) — environment has no Maven; backend never compiled.
- `backend/src/test/**` tests — not re-executed, progress log summary trusted.
- `scripts/*.sh` full bodies — trusted per devops progress summary.
- `.github/workflows/*.yml` — CI pipelines out of smoke-boot scope.
- Mockup / design files under `0. Design1_Mokup/`.
- Root-level duplicate HTML files (`index.html`, `login.html`, etc.) — per `04_frontend_cleanup_notes.md` these are archive.
- `_workspace/01_architect_adr/` ADR files — referenced via architect deliverables summary; specific ADR content not opened.
- Prompt file *contents* (`prompts/**.md`) — existence confirmed, prompt variable coverage not validated against caller's variable map.

## Review posture for next pass

When backend first compiles and `docker-compose up` becomes feasible:
1. Re-run cross-comparison on the items marked ⚪ — full field table.
2. Add runtime assertions for the 8 smoke scenarios in SKILL.md §스모크 테스트 시나리오.
3. Open every prompt file and cross-check `{{var}}` set vs backend service's `vars` Map keys — currently untested.
4. Verify `application-mock.yml` is activated in at least one CI matrix cell (so services start without AWS creds).
