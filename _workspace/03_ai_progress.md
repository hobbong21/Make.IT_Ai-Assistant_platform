# 03 — AI Integration Layer Progress

**Author**: ai-engineer agent
**Date**: 2026-04-20
**Status**: Complete for Phase 3 scope. Ready for backend wiring.

## Files created

### Java — interfaces (4)
- `backend/src/main/java/com/humanad/makit/ai/ContentGenerationStrategy.java`
- `backend/src/main/java/com/humanad/makit/ai/ChatbotEngine.java`
- `backend/src/main/java/com/humanad/makit/ai/KnowledgeRetriever.java`
- `backend/src/main/java/com/humanad/makit/ai/EmbeddingService.java`

### Java — DTO records (13)
All under `backend/src/main/java/com/humanad/makit/ai/dto/`:
- `ContentType.java` (enum)
- `ModelInfo.java`
- `TextGenerationRequest.java` (+ nested `Quality` enum)
- `GeneratedContent.java`
- `ImageGenerationRequest.java`
- `ImageEditRequest.java` (+ nested `Operation` enum)
- `GeneratedImage.java`
- `ChatRequest.java`
- `ChatResponse.java` (+ nested `Citation`, `Usage`)
- `ChatStreamChunk.java` (+ nested `EventType`)
- `ConversationContext.java` (+ nested `Turn` / `Role`) — DTO variant; entity is backend's concern
- `RetrievedChunk.java`
- `RetrievalOptions.java`
- `KnowledgeDocumentRef.java`

### Java — Bedrock layer (6)
Under `.../ai/bedrock/`:
- `BedrockProperties.java` — `@ConfigurationProperties(prefix = "aws.bedrock")`
- `BedrockConfig.java` — `BedrockRuntimeClient` bean, guarded by `aws.bedrock.enabled`
- `BedrockClient.java` — narrow interface used by strategies
- `BedrockInvocation.java` — internal invocation result record
- `BedrockInvocationException.java`
- `BedrockService.java` — real impl with `@CircuitBreaker/@Retry/@RateLimiter(name="bedrock")`, Claude vs Titan body/parse split, Micrometer metrics
- `MockBedrockService.java` — deterministic offline impl, active when `aws.bedrock.enabled=false`

### Java — content strategies (3)
Under `.../ai/content/`:
- `ClaudeTextContentStrategy.java` — handles BLOG_POST/AD_COPY/INSTAGRAM_CAPTION/EMAIL_TEMPLATE/MULTIMODAL. Routes HIGH → Sonnet, else Haiku.
- `StableDiffusionImageStrategy.java` — handles IMAGE/IMAGE_EDIT. Uses `ObjectProvider<S3ImageUploader>` for optional S3 upload.
- `S3ImageUploader.java` — single-method interface for backend/devops to implement.

### Java — embedding (1)
- `backend/src/main/java/com/humanad/makit/ai/embedding/TitanEmbeddingService.java`

### Java — RAG (3)
Under `.../ai/rag/`:
- `PgVectorKnowledgeRetriever.java` — JdbcTemplate-based; expects `knowledge_chunks` table with `VECTOR(1024)`.
- `TextChunker.java` — recursive character splitter.
- `RAGChatbotEngine.java` — orchestrates embed → retrieve → prompt → Claude → ChatResponse. Streaming is synthesized in v1.

### Java — prompt (1)
- `.../ai/prompt/PromptLoader.java` — classpath loader with `{{var}}` substitution, cache, optional reload via `-Dmakit.prompts.reload=true`.

### Java — config (2)
Under `.../ai/config/`:
- `AsyncConfig.java` — defines `aiExecutor` bean backed by virtual threads (guarded by `@ConditionalOnMissingBean(name="aiExecutor")`).
- `CacheConfig.java` — `aiCacheManager` RedisCacheManager with per-cache TTLs: `ai:nlp`(1h), `ai:url`(30m), `ai:sentiment`(1h), `ai:rag:retrieval`(5m).

### Prompts (8)
Under `backend/src/main/resources/prompts/`:
- `data/nlp/sentiment.md`
- `data/youtube/comment_cluster.md`
- `data/url/seo_summary.md`
- `marketing/instagram_caption.md`
- `marketing/image_prompt.md`
- `commerce/rag_system.md`
- `commerce/review_sentiment.md`
- `commerce/modelshot_prompt.md`

Each file follows the same convention:
- Version comment on line 1
- `--- system ---` block
- `--- user ---` block
- `<user_input>` tags around untrusted content
- Explicit JSON schema or literal answer constraints

### Config / docs
- `_workspace/03_ai_application_yml_snippet.yaml`
- `_workspace/03_ai_progress.md` (this file)
- `_workspace/03_ai_decisions.md`

**Totals**: 30 Java files + 8 prompts + 3 workspace docs.

## Bean names / injection points for backend-engineer

| Bean | Type | Notes |
|---|---|---|
| `bedrockClient` (primary) | `BedrockClient` | `BedrockService` (real) or `MockBedrockService` — chosen by `aws.bedrock.enabled` |
| `claudeTextContentStrategy` | `ContentGenerationStrategy` | inject as `List<ContentGenerationStrategy>` and pick by `.supports(type)` |
| `stableDiffusionImageStrategy` | `ContentGenerationStrategy` | idem |
| `titanEmbeddingService` | `EmbeddingService` | default bean name from class |
| `pgVectorKnowledgeRetriever` | `KnowledgeRetriever` | — |
| `RAGChatbotEngine` | `ChatbotEngine` | — |
| `aiExecutor` | `AsyncTaskExecutor` | virtual-thread executor |
| `aiCacheManager` | `RedisCacheManager` | mark on `@Cacheable(cacheManager="aiCacheManager", value="ai:nlp")` etc. |
| `promptLoader` | `PromptLoader` | — |

Expected but NOT provided here (backend-engineer owns):
- `S3ImageUploader` bean — implement with AWS SDK v2 S3Client. Without it, the image strategy falls back to `data:` URLs (dev only).
- `KnowledgeDocument` entity + repository (commerce module). Retriever only stores/queries `knowledge_chunks`.
- REST controllers. None are provided here by design.

## Property keys (must be present in final application.yml)

Top-level block required:
```
aws.bedrock.enabled
aws.bedrock.region
aws.bedrock.models.{claudeHaiku, claudeSonnet, titanEmbed, stableDiffusion, titanImage}
aws.bedrock.defaults.{maxTokensText, maxTokensAnalysis, temperature, temperatureAnalysis, imageSteps, imageCfgScale}
aws.bedrock.tariff.{<modelId>}.{inputPer1k, outputPer1k}
aws.bedrock.s3.{bucket, assetPrefix}
aws.bedrock.rag.{chunkSize, chunkOverlap}
resilience4j.{circuitbreaker,retry,ratelimiter}.instances.bedrock.*
```
Full snippet: `_workspace/03_ai_application_yml_snippet.yaml`.

## Database (backend-engineer + devops)

Flyway migration needed — not authored here. See ADR-001. Required DDL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID PRIMARY KEY,
  document_id   VARCHAR(64) NOT NULL,
  chunk_index   INT NOT NULL,
  text          TEXT NOT NULL,
  embedding     VECTOR(1024) NOT NULL,
  title         TEXT,
  source_type   VARCHAR(32),
  company_id    VARCHAR(64),
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_ivfflat
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_idx ON knowledge_chunks (document_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_company_idx ON knowledge_chunks (company_id);
```

## IAM (devops-engineer)

Bedrock invoke + S3 read/write. See SKILL.md for canonical JSON.

## Decisions (see 03_ai_decisions.md)

- pgvector > OpenSearch for v1 (ADR-001)
- Prompt template format: single .md with `--- system ---` / `--- user ---` markers
- Streaming chatbot synthesized in v1 (not real Bedrock streaming) — replace in v1.1
- Base64 images uploaded via `S3ImageUploader` interface; DB stores URL only

## Known TODOs / blockers

1. **Real SSE streaming**: replace synthetic `chatStream` with `BedrockRuntimeAsyncClient.invokeModelWithResponseStream` when backend adds reactive deps.
2. **S3ImageUploader**: concrete S3 bean must come from backend/devops.
3. **Context persistence**: `RAGChatbotEngine` uses an in-memory `ConcurrentHashMap` for contexts. Migrate to Redis with key `session:{userId}:{sessionId}` (TTL 30m) in v1.1. Aligns with system-design §7.4.
4. **Background removal**: `StableDiffusionImageStrategy.editImage` REMOVE_BG operation currently routes through SDXL image-to-image. A dedicated `RekognitionBgRemoveStrategy` may be a better fit — requires an ADR decision (SKILL.md §도메인별 구현 범위).
5. **Cost tariff**: values are 2026-04 estimates. Review quarterly.
6. **Output parsing helper**: strategies return raw `text` containing ````json { ... } ```` blocks. Backend needs a tiny `JsonBlockExtractor` utility (trivial) to parse — not bundled here because `common` module owns shared utilities.
7. **No unit tests bundled**: qa-engineer will produce them from the prompt contracts.
8. **No pom.xml authored** (per instructions). Required deps for backend-engineer's pom:
   - `software.amazon.awssdk:bedrockruntime:2.25.x`
   - `io.github.resilience4j:resilience4j-spring-boot3:2.2.x`
   - `org.springframework.boot:spring-boot-starter-data-redis`
   - `org.springframework.boot:spring-boot-starter-cache`
   - `io.projectreactor:reactor-core`
   - `io.micrometer:micrometer-registry-prometheus`
   - `com.fasterxml.jackson.core:jackson-databind`
