# 02 — Backend Fixes Round 1 (QA blockers + majors)

**Author**: backend-engineer
**Date**: 2026-04-20
**Source QA report**: `_workspace/06_qa_report_2026-04-20.md`

## Files touched

### New files (2)
- `backend/src/main/java/com/humanad/makit/ai/ContentStrategySelector.java`
- `backend/src/main/java/com/humanad/makit/config/MockUploaderConfig.java`

### Modified Java files (8)
- `backend/src/main/java/com/humanad/makit/config/AsyncConfig.java` — removed `aiExecutor` bean
- `backend/src/main/java/com/humanad/makit/config/CorsConfig.java` — explicit headers + env var default
- `backend/src/main/java/com/humanad/makit/commerce/chatbot/ChatbotStreamController.java` — inject `contextId` into `done` SSE payload
- `backend/src/main/java/com/humanad/makit/data/nlp/NlpAnalysisService.java` — selector + correct prompt key
- `backend/src/main/java/com/humanad/makit/data/url/UrlAnalysisService.java` — selector
- `backend/src/main/java/com/humanad/makit/data/youtube/YoutubeCommentsService.java` — selector
- `backend/src/main/java/com/humanad/makit/marketing/feed/FeedGenerationService.java` — selector
- `backend/src/main/java/com/humanad/makit/marketing/image/BackgroundRemovalService.java` — selector
- `backend/src/main/java/com/humanad/makit/commerce/modelshot/ModelshotService.java` — selector + modelshot prompt key
- `backend/src/main/java/com/humanad/makit/commerce/review/ReviewAnalysisService.java` — selector

### Config files (4)
- `backend/src/main/resources/application.yml` — merged full AI snippet (nested bedrock block, resilience4j, metrics)
- `backend/src/main/resources/application-docker.yml` — minimal nested bedrock block
- `backend/src/main/resources/application-prod.yml` — minimal nested bedrock block
- `backend/pom.xml` — added `io.micrometer:micrometer-registry-prometheus`

### Flyway migration (1)
- `backend/src/main/resources/db/migration/V202604201203__create_knowledge.sql` — rewritten
  to match `PgVectorKnowledgeRetriever` INSERT/SELECT shape. Nothing has run in CI, so the
  original migration was rewritten in place (no new V202604201208 needed; slot already used
  by `seed_demo_user`).

## QA findings resolved

| ID | Status | Notes |
|---|---|---|
| QA-001 (NoUniqueBean) | RESOLVED | New `ContentStrategySelector` component; all 7 services inject it and call `.select(ContentType)` to pick the right bean per ai-engineer contract. |
| QA-002 (Duplicate aiExecutor) | RESOLVED | Removed `aiExecutor` from `com.humanad.makit.config.AsyncConfig`; AI module owns it via `@ConditionalOnMissingBean`. `jobExecutor` retained. |
| QA-003 (BedrockProperties schema) | RESOLVED | Merged `_workspace/03_ai_application_yml_snippet.yaml` into `application.yml`. Added minimal nested block to `application-docker.yml` and `application-prod.yml`. `BEDROCK_TEXT_MODEL_ID` / `BEDROCK_IMAGE_MODEL_ID` env vars preserved by mapping into `models.claudeHaiku` / `models.stableDiffusion`. |
| QA-004 (Prompt key mismatch) | RESOLVED | Updated `NlpAnalysisService` to `data/nlp/sentiment.md`. Other services either already use correct keys (`marketing/instagram_caption.md` in FeedGenerationService) or are v1 stubs flagged with TODO comments naming the correct key (`data/url/seo_summary.md`, `data/youtube/comment_cluster.md`, `commerce/review_sentiment.md`). ModelshotService now carries `commerce/modelshot_prompt.md` via the request metadata map. |
| QA-005 (knowledge_chunks schema drift) | RESOLVED | Rewrote `V202604201203__create_knowledge.sql` with: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `document_id VARCHAR(64) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE`, `chunk_index INT`, `text TEXT`, `embedding VECTOR(1024)`, `title VARCHAR(512)`, `source_type VARCHAR(64)`, `company_id VARCHAR(128)`, `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`, `created_at`/`updated_at TIMESTAMPTZ`. Indexes: IVFFLAT cosine on embedding, btree on document_id, partial btree on company_id. |
| QA-006 (SSE done missing contextId) | RESOLVED in controller | `ChatbotStreamController` now resolves `contextId` up front and injects it into the JSON payload of every `done` event via `injectContextId(...)`. Avoids touching ai-engineer's `RAGChatbotEngine`. |
| QA-007 (CORS origin list/env) | RESOLVED (backend side) | `CorsConfig` honours `CORS_ALLOWED_ORIGINS` env var; default list includes `http://localhost`, `:80`, `:3000`, `:5173`. Devops still needs to forward the var through compose (their QA-010 ticket). |
| QA-008 (CORS allowedHeaders=*) | RESOLVED | Explicit `Authorization, Content-Type, X-Request-Id` list. |
| QA-011 (Prometheus dep) | RESOLVED | Added `micrometer-registry-prometheus` (version managed by Spring Boot parent). |

## Findings NOT owned by backend (untouched)

- QA-010 (docker-compose env wiring) — devops-engineer
- QA-009 (duplicate `@EnableConfigurationProperties`) — ai-engineer; documentation-only
- QA-M01..M14 — minor, per-owner; ride the release train

## Extra notes

- The task description instructed `document_id UUID NOT NULL REFERENCES knowledge_documents(document_id)`, but `knowledge_documents.document_id` is declared `VARCHAR(64)` in the existing migration and `PgVectorKnowledgeRetriever` passes a Java `String`. Making the child `UUID` would break FK type matching and the retriever binding (`ps.setString(2, ref.documentId())`). Kept as `VARCHAR(64)` to preserve compile/runtime correctness. If the architect wants UUID, both parent and retriever need to change in a coordinated patch.
- `InMemoryS3ImageUploader` is profile-gated to `mock` only — returns a `data:` URL tagged with a mock key, so it's safe in dev but obviously not prod.
- `ContentStrategySelector` is registered as a generic `@Component`; no new configuration required.
- `ChatbotStreamController.injectContextId()` is deliberately defensive: it handles empty strings, non-JSON data, and avoids duplicate `contextId` keys.

## Uncertainties / follow-ups

1. `UrlAnalysisService`, `YoutubeCommentsService`, `ReviewAnalysisService` still return stubs; wiring the actual AI calls is pending ai-engineer (as per current progress docs). Their prompt-key TODOs are now documented in-line.
2. `BedrockInvocationException` path when Bedrock is disabled in `mock` profile — ai-engineer's `MockBedrockService` covers that; verified via property flag `aws.bedrock.enabled=false` in `application-mock.yml`.
3. Legacy top-level keys `aws.bedrock.text-model-id` / `image-model-id` were removed from `application.yml` — their values were migrated into the nested `models` block via `${BEDROCK_TEXT_MODEL_ID:...}` and `${BEDROCK_IMAGE_MODEL_ID:...}` defaults, preserving env-var compatibility. (QA-M11 cleared.)
