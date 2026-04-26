# MaKIT QA Round-2 Re-verification

**Author**: qa-engineer
**Date**: 2026-04-20
**Scope**: Focused re-verification of backend-engineer Round-1 fixes (QA-001..QA-008, QA-010, QA-011). Static analysis only. MINORs not re-scanned.

## Summary

| Status | Count |
|---|---|
| CONFIRMED FIXED | 10 |
| PARTIAL | 0 |
| STILL BROKEN | 0 |
| New regressions introduced | 0 |

**Recommendation: GO for Phase 5 smoke validation** (subject to the unchanged caveats from Round 1 — MAJOR/MINOR items already flagged in the original report that were out of scope for this round).

---

## Per-finding verification

### QA-001 — ContentGenerationStrategy NoUniqueBean — CONFIRMED FIXED

New file present: `backend/src/main/java/com/humanad/makit/ai/ContentStrategySelector.java`.

Evidence:
- `ContentStrategySelector.java:22-37` — `@Component`, injects `List<ContentGenerationStrategy> strategies`, method `select(ContentType type)` filters by `supports(type)`, throws `IllegalStateException` when none matches.
- All 7 services now inject `ContentStrategySelector strategySelector` instead of the raw interface:
  - `NlpAnalysisService.java:25,39`  → `strategySelector.select(ContentType.BLOG_POST)`
  - `UrlAnalysisService.java:19` (field present; stub still returns placeholder but wiring is sound)
  - `YoutubeCommentsService.java:23` (stub)
  - `FeedGenerationService.java:31,65` → `select(ContentType.INSTAGRAM_CAPTION)`
  - `BackgroundRemovalService.java:29,47` → `select(ContentType.IMAGE_EDIT)`
  - `ModelshotService.java:25,53` → `select(ContentType.IMAGE_EDIT)`
  - `ReviewAnalysisService.java:27` (stub, field present)
- Grep confirmed: no remaining service declares `private final ContentGenerationStrategy` as a field.

### QA-002 — Duplicate aiExecutor bean — CONFIRMED FIXED

Evidence:
- `backend/src/main/java/com/humanad/makit/config/AsyncConfig.java:18-24` now defines ONLY `@Bean("jobExecutor")`. Comments explicitly document the removal.
- Global grep for `@Bean(name = "aiExecutor"` / `@Bean("aiExecutor"` returns a single hit: `backend/.../ai/config/AsyncConfig.java:24`, which remains `@ConditionalOnMissingBean(name = "aiExecutor")`. No other `aiExecutor` bean definitions anywhere in the tree.

### QA-003 — BedrockProperties schema in YAML — CONFIRMED FIXED

`backend/src/main/resources/application.yml:55-96` now contains the nested block:
- `aws.bedrock.models.{claudeHaiku,claudeSonnet,titanEmbed,stableDiffusion,titanImage}` (lines 61-66)
- `aws.bedrock.defaults` (67-73)
- `aws.bedrock.rag` (74-76)
- `aws.bedrock.tariff.*` (78-93)
- `aws.bedrock.s3.{bucket,assetPrefix}` (94-96)
- `resilience4j.circuitbreaker/retry/ratelimiter` for `bedrock` (98-125)
- `management.endpoints.web.exposure.include: health,info,metrics,prometheus` (135)

Legacy top-level `text-model-id` / `image-model-id` keys are gone; env-var compatibility preserved via `${BEDROCK_TEXT_MODEL_ID:...}` and `${BEDROCK_IMAGE_MODEL_ID:...}` defaults inside the `models` block.

`application-docker.yml:14-27` — minimal nested block present (`models` + `s3.bucket`). ✓
`application-prod.yml:17-31` — same minimal nested block. ✓

### QA-004 — Prompt key alignment — CONFIRMED FIXED

Grep of service prompt-key references vs files on disk:

| Service reference | File on disk |
|---|---|
| `NlpAnalysisService.java:30` → `"data/nlp/sentiment.md"` | `prompts/data/nlp/sentiment.md` ✓ |
| `FeedGenerationService.java:54` → `"marketing/instagram_caption.md"` | `prompts/marketing/instagram_caption.md` ✓ |
| `ModelshotService.java:51` → `"commerce/modelshot_prompt.md"` (metadata map) | `prompts/commerce/modelshot_prompt.md` ✓ |
| `ReviewAnalysisService.java:18` (doc/TODO) → `"commerce/review_sentiment.md"` | `prompts/commerce/review_sentiment.md` ✓ |
| `UrlAnalysisService.java:13` (doc/TODO) → `"data/url/seo_summary.md"` | `prompts/data/url/seo_summary.md` ✓ |
| `YoutubeCommentsService.java:15` (doc/TODO) → `"data/youtube/comment_cluster.md"` | `prompts/data/youtube/comment_cluster.md` ✓ |
| `RAGChatbotEngine.java:46` → `"commerce/rag_system.md"` | `prompts/commerce/rag_system.md` ✓ |

All 8 referenced prompts exist. No remaining `nlp_analyze.md` (stale) references.

### QA-005 — knowledge_chunks schema — CONFIRMED FIXED

`backend/src/main/resources/db/migration/V202604201203__create_knowledge.sql` rewritten in place (slot V202604201208 is used by `seed_demo_user`, so reuse was necessary and appropriate).

Columns verified (lines 26-39):
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` ✓
- `document_id VARCHAR(64) NOT NULL REFERENCES knowledge_documents(document_id) ON DELETE CASCADE` ✓ — FK type matches parent (`V202604201203:5` declares parent `document_id VARCHAR(64) PRIMARY KEY`). Retriever calls `ps.setString(2, ref.documentId())`, consistent.
- `chunk_index INT NOT NULL` ✓
- `text TEXT NOT NULL` ✓
- `embedding vector(1024) NOT NULL` ✓
- `title VARCHAR(512)`, `source_type VARCHAR(64)`, `company_id VARCHAR(128)` ✓
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb` ✓
- `created_at`, `updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP` ✓

IVFFLAT index: `idx_knowledge_chunks_embedding_ivfflat` USING ivfflat(embedding vector_cosine_ops) with lists=100 (lines 42-43). ✓

**Note**: backend-engineer's deliberate choice of `VARCHAR(64)` over the Round-1 task's nominal `UUID` is justified in the fix report and is the correct call — changing parent to UUID would cascade through `PgVectorKnowledgeRetriever`. No action required; documenting here so orchestrator/architect is aware the data-model spec still says UUID.

### QA-006 — SSE `done` event contextId — CONFIRMED FIXED

`ChatbotStreamController.java:34-56` now resolves `effectiveContextId` up front (random UUID if missing), rebuilds the request with it, and wraps the downstream stream: for each chunk whose `event() == EventType.done`, `injectContextId(data, effectiveContextId)` is called (line 51).

`injectContextId` (lines 68-83) is defensive: handles null, empty string, non-JSON payload (emits a fresh `{"contextId":"..."}`), and skips if the key is already present. Escaping via `escapeJson` covers quotes and backslashes.

No modification to `RAGChatbotEngine` required — controller-level inject is clean.

### QA-007 — CORS env var & default origins — CONFIRMED FIXED

`CorsConfig.java:30` reads:
```
@Value("${makit.cors.allowed-origins:${CORS_ALLOWED_ORIGINS:<defaults>}}")
```
Two-layer resolution: YAML key `makit.cors.allowed-origins` (defined in `application.yml:129`) → env var `CORS_ALLOWED_ORIGINS` → hardcoded default list.

Default list (`CorsConfig.java:27-28`) includes `http://localhost`, `:80`, `:3000`, `:5173`. ✓

### QA-008 — CORS allowedHeaders explicit — CONFIRMED FIXED

`CorsConfig.java:44-49` — explicit list `Authorization, Content-Type, X-Request-Id` replacing prior `List.of("*")`. Compatible with `allowCredentials=true` (set at line 37).

### QA-010 — docker-compose CORS pipe-through — CONFIRMED FIXED

`docker-compose.yml:50`:
```
CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-http://localhost,http://localhost:80,http://localhost:3000,http://localhost:5173}
```
Env var is forwarded with a same-default fallback, so dev deployments do not break and prod can override via `.env`.

(Note: the `.env.example` still does not list `CORS_ALLOWED_ORIGINS` — that was flagged as QA-M10 / minor and is out of scope for this round.)

### QA-011 — Prometheus dependency — CONFIRMED FIXED

`backend/pom.xml:65-68`:
```
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```
Spring Boot parent manages the version. `/actuator/prometheus` endpoint will now be backed by a real `PrometheusScrapeEndpoint` once the app starts; the `management.endpoints.web.exposure.include` list in `application.yml:135` already includes `prometheus`.

---

## New issues / regressions introduced by Round-1 fixes

None observed. Static cross-checks:
- `ContentStrategySelector` is a plain `@Component` with no circular-dependency risk (depends on `List<ContentGenerationStrategy>` which Spring injects as all implementers — `ClaudeTextContentStrategy`, `StableDiffusionImageStrategy`).
- Removing `aiExecutor` from `config/AsyncConfig` leaves the AI module's `aiExecutor` (typed `AsyncTaskExecutor`) as the sole candidate — `@Qualifier("aiExecutor") AsyncTaskExecutor` injections in the AI strategies now resolve cleanly.
- New `CorsConfig` binding precedence `makit.cors.allowed-origins` → `CORS_ALLOWED_ORIGINS` → default is consistent with `application.yml:129`; no other beans read the legacy key.
- Knowledge migration rewritten in place is safe because Flyway has not run in CI (per fix report). Any environment where V202604201203 already ran against the old schema would need manual repair — orchestrator should confirm no such environment exists.

---

## Out-of-scope / still outstanding (informational)

Pre-existing MAJOR/MINOR from Round 1 not part of this round's fix list:
- QA-009 (duplicate `@EnableConfigurationProperties`) — documentation-only, owned by ai-engineer.
- QA-M01..QA-M14 — minor, release-train.
- `PgVectorKnowledgeRetriever` contract note: backend-engineer kept `document_id VARCHAR(64)` (deliberate, justified). Architect/data-model doc (`_workspace/01_architect_data_model.md`) still says UUID — recommend a doc update rather than a code change.

---

## Final recommendation

**GO for Phase 5 smoke validation.** All 5 original BLOCKERs (QA-001..QA-005) and the 5 targeted MAJORs (QA-006..QA-008, QA-010, QA-011) are resolved at the static level. No new regressions introduced. The Spring context should now come up cleanly; first-call code paths for NLP, RAG, SSE streaming, and Bedrock property binding should all bind without NPE/bean-collision errors. Runtime smoke must still confirm actual Bedrock calls, Flyway migration apply order, and CORS preflight behavior from real browser origins.
