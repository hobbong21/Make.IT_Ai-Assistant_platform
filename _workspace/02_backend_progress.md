# Backend progress log

**Author**: backend-engineer
**Date**: 2026-04-20
**Status**: v1 scaffold complete

## Summary

Full Spring Boot 3.2 + Java 21 backend scaffolded under `backend/`. Port `8083`. Maven project ready to `mvn clean package` (pending coordination items below).

## File inventory

### Root
- `backend/pom.xml` — dependencies: web, data-jpa, data-redis, validation, security, actuator, cache, aop, reactor-core, springdoc-openapi 2.3, postgres + flyway, jjwt 0.12.5, aws-sdk-v2 bedrockruntime + s3, resilience4j-spring-boot3, lombok, mapstruct, testcontainers, rest-assured
- `backend/README.md`, `backend/.gitignore`

### `com.humanad.makit`
- `MaKITApplication` — `@EnableAsync @EnableCaching @EnableTransactionManagement`, banner off
- `config/` — `SecurityConfig`, `CorsConfig`, `RedisConfig`, `OpenApiConfig`, `AsyncConfig` (virtual-thread executors `aiExecutor`/`jobExecutor`), `JacksonConfig`
- `common/` — `ApiErrorResponse` record, `MarKITException` + `AuthenticationException`/`ResourceNotFoundException`/`ValidationException`/`ConflictException`/`ExternalServiceException`, `GlobalExceptionHandler` (@RestControllerAdvice), `PageResponse`, `RequestIdFilter` (MDC + `X-Request-Id` echo), `HealthCheckController`
- `auth/` — `User` entity (UUID PK, `@Version`, JSONB preferences), `UserRepository`, `UserRole`, `AuthController`, `AuthService`/`AuthServiceImpl`, `JwtTokenProvider` (HS256, 15m/7d from `JWT_SECRET`), `JwtAuthenticationFilter`, `UserDetailsServiceImpl`, `RefreshTokenService` (Redis `makit:refresh:{jti}` + `makit:blacklist:{jti}`), DTOs `LoginRequest`/`LoginResponse`/`UserDto`/`RegisterRequest`/`RefreshRequest`
- `data/` — `DataIntelligenceController` with 5 endpoints, `nlp/NlpAnalysisService`, `youtube/{Comments,Influence,KeywordSearch}Service`, `url/UrlAnalysisService` — all inject `ContentGenerationStrategy` by interface
- `marketing/` — `MarketingIntelligenceController` (feed/generate sync+async, image/remove-bg multipart), `feed/FeedGenerationService` (uses `aiExecutor` for image jobs), `image/BackgroundRemovalService` (uses `ContentGenerationStrategy.editImage(REMOVE_BG)`), `campaign/Campaign` + `CampaignAnalytics` entities + repos
- `commerce/` — `CommerceBrainController`, `chatbot/ChatbotService` (persists `ConversationContext` + `ChatMessage`, delegates to `ChatbotEngine`), `chatbot/ChatbotStreamController` (SSE with 15s ping), `review/ReviewAnalysisService`, `modelshot/ModelshotService` (async JobService), `knowledge/KnowledgeDocumentService` (metadata only; chunks owned by ai-engineer)
- `job/` — `JobExecution` entity, repository, `JobService` (PENDING→RUNNING→SUCCESS/FAILED), `JobController` with 3 domain-scoped endpoints, `JobStatusResponse`, `JobAcceptedResponse`
- `audit/` — `AuditLog` entity + repo, `AuditAspect` (logs LOGIN, REGISTER, feed/generate, modelshot/generate)

### Resources
- `application.yml` (port 8083, `ddl-auto: validate`, Hikari 20/3s, Flyway on)
- `application-docker.yml`, `application-prod.yml` (no JWT default), `application-mock.yml` (`ai.bedrock.enabled=false`)
- `db/migration/V00000001__init_extensions.sql` (pgcrypto + vector)
- `V202604201200` users, `V202604201201` audit_logs, `V202604201202` conversation_contexts + chat_messages, `V202604201203` knowledge_documents + knowledge_chunks + ivfflat, `V202604201204` campaigns + campaign_analytics, `V202604201205` contents, `V202604201206` job_executions, `V202604201207` reviews, `V202604201208` seed demo user

### Tests
- `JwtTokenProviderTest` — round-trip, refresh-type claim, 15-min TTL
- `AuthServiceTest` (mockito) — missing user, bad password, happy path, duplicate email
- `GlobalExceptionHandlerTest` — 401/404/500 shapes
- `application-test.yml` uses H2 in Postgres mode so repository tests can switch to it if Testcontainers unavailable

### File counts
- Java: **62** files
- SQL migrations: **9** files
- YAML: **5** files (4 main + 1 test)

## Tables created (Flyway → entity mapping)
| Table | Entity |
|---|---|
| users | `auth.User` |
| audit_logs | `audit.AuditLog` |
| conversation_contexts | `commerce.chatbot.ConversationContext` |
| chat_messages | `commerce.chatbot.ChatMessage` |
| knowledge_documents | `commerce.knowledge.KnowledgeDocument` |
| knowledge_chunks | (ai-engineer-owned; table only, no JPA entity in backend) |
| campaigns | `marketing.campaign.Campaign` |
| campaign_analytics | `marketing.campaign.CampaignAnalytics` |
| contents | (table only; entity deferred to first content-listing endpoint) |
| job_executions | `job.JobExecution` |
| reviews | `commerce.review.Review` |

## AI interface integration

Beans consumed by type (never by impl class name):
- `ContentGenerationStrategy` — injected in `NlpAnalysisService`, `UrlAnalysisService`, `FeedGenerationService`, `BackgroundRemovalService`, `ModelshotService`, `ReviewAnalysisService`, `YoutubeCommentsService`
- `ChatbotEngine` — injected in `ChatbotService` (sync + SSE via `Flux<ChatStreamChunk>`)
- `EmbeddingService`, `KnowledgeRetriever` — not yet injected; reserved for ai-engineer's indexing pipeline

AI DTOs at `com.humanad.makit.ai.dto.*` already exist (authored by ai-engineer): `TextGenerationRequest` (with nested `Quality` enum), `GeneratedContent`, `ImageGenerationRequest`, `ImageEditRequest` (with `Operation`), `GeneratedImage`, `ChatRequest`, `ChatResponse` (with nested `Citation`/`Usage`), `ChatStreamChunk` (with `EventType`), `ConversationContext` (with `Turn`/`Role`), `ModelInfo`, `RetrievalOptions`, `RetrievedChunk`, `KnowledgeDocumentRef`.

## Known issues / TODOs delegated

- **ai-engineer**: No concrete `ContentGenerationStrategy` bean exists yet. Until one is registered (e.g. `BedrockContentGenerationStrategy`), Spring startup will fail at DI. Suggest registering a `NoOpContentGenerationStrategy` behind `@Profile("mock")` or `@ConditionalOnProperty(ai.bedrock.enabled=false)` so backend can boot offline.
- **ai-engineer**: `ChatbotEngine` implementation bean needed for commerce endpoints. Same mock-profile suggestion applies.
- **ai-engineer**: Prompt templates referenced by services (`data/nlp_analyze.md`, `marketing/instagram_caption.md`) must live under `src/main/resources/prompts/` on ai-engineer's side.
- **ai-engineer**: `BackgroundRemovalService` and `FeedGenerationService` currently upload only implicitly — actual S3 upload of multipart input is flagged TODO. The `ImageEditRequest.sourceImageUrl` expects an S3 URL; the service cannot yet produce one on its own.
- **qa-engineer**: Demo user seeded as `marketer@example.com` / `password123` (BCrypt hash in V202604201208). Generate your own accounts via `/api/auth/register`.
- **devops-engineer**: env vars required — `JWT_SECRET` (required, no default in prod), `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`, `SPRING_REDIS_HOST`, `AWS_REGION`, `S3_BUCKET`, `CORS_ALLOWED_ORIGINS`. Swagger at `/swagger-ui.html`, health at `/api/health` + `/actuator/health`, metrics Prometheus at `/actuator/prometheus`. Dockerfile is your responsibility.
- **frontend-engineer**: API base `http://localhost:8083`. Login returns `{token, refreshToken, tokenType, expiresInSec, user}`. Error responses follow `ApiErrorResponse` shape; `X-Request-Id` is echoed on every response.
- **Rate limiting** (login 10/min per IP) not implemented at app level — expected at gateway/nginx. Flag for devops-engineer.
- **Contents entity** not created as JPA class; table exists for ai-engineer or future Content listing controller.
- **MapStruct** is on classpath but no mappers yet — current mappers are manual (toDto methods). Swap to MapStruct when duplication grows.
- **Seed user BCrypt hash** is a placeholder value — regenerate and replace in V202604201208 or add a one-off admin tool to reset the password.
