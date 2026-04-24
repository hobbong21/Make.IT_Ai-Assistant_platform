# MaKIT — QA Bug Patterns Catalog

**Author**: qa-engineer
**Date**: 2026-04-20
**Format**: Per integration-qa SKILL.md §"버그 패턴 카탈로그"

Patterns are generalized recurring failure modes observed across 5 boundaries in the 2026-04-20 cross-comparison. Each entry proposes a **contract-level** (architect-level) defense so the same shape of bug cannot recur.

---

## BP-001 — Interface with multiple implementations injected as single bean

**Symptom**: Spring context fails to start with `NoUniqueBeanDefinitionException` listing all implementations.

**Root cause**: Architect specifies a strategy interface (e.g. `ContentGenerationStrategy`) with N implementations distinguished by a `supports(type)` method. Architect assumes consumers will inject `List<Interface>` and dispatch; a consumer instead writes `private final Interface dep` and Spring sees ambiguity.

**Prevention (contract)**:
1. Architect ADR must state the injection idiom explicitly ("always inject as `List<ContentGenerationStrategy>`, never as a single bean").
2. Provide a thin `ContentGenerationDispatcher` bean that takes `List<…>` and exposes `forType(ContentType)` — services inject the dispatcher instead of the raw list. Single responsibility for the strategy lookup.
3. Add a startup smoke test: `@SpringBootTest` that asserts `ctx.getBeansOfType(ContentGenerationStrategy.class).size() > 1` and that the dispatcher bean resolves each `ContentType`.

**First occurrence**: QA-001 (7 services injected `ContentGenerationStrategy` directly).

---

## BP-002 — Bean name collision between co-owned modules

**Symptom**: `BeanDefinitionOverrideException` at startup, or silent selection of the wrong impl by `@Qualifier(name)`.

**Root cause**: Two agents each define the same `@Bean(name=X)` — one guarded by `@ConditionalOnMissingBean`, the other not. Scan order determines who wins; the unguarded one may shadow the guarded one or blow up depending on order.

**Prevention (contract)**:
1. Architect assigns **sole ownership** of each named bean in a bean-ownership table (`_workspace/01_architect_adr/`). Example: `aiExecutor → ai-engineer, jobExecutor → backend-engineer`.
2. Every `@Bean("name")` declaration MUST be `@ConditionalOnMissingBean(name="name")` unless the bean is owned exclusively.
3. CI lint: grep for duplicate `@Bean("...")` strings across modules; fail if the same name is declared without `ConditionalOnMissingBean` on at least one side.

**First occurrence**: QA-002 (`aiExecutor` defined in both `com.humanad.makit.config.AsyncConfig` and `com.humanad.makit.ai.config.AsyncConfig`).

---

## BP-003 — Properties record declared but yml keys unmerged

**Symptom**: `NullPointerException` on first use of nested properties field — `props.models().claudeHaiku()` NPEs because `models` is null.

**Root cause**: One agent authors an exhaustive `@ConfigurationProperties` record, another agent authors the `application.yml` with only a flat subset. The record's component components are null. No startup validation catches it because Spring binds partial yml without error.

**Prevention (contract)**:
1. Use `@Validated` on the properties record and `@NotNull` on every nested record field. Boot fails on startup if missing.
2. Architect owns `application.yml` skeleton; implementer agents append their sub-blocks via `@PropertySource`/`spring.config.import` rather than hand-merging.
3. CI test: `@EnableConfigurationProperties` smoke that loads each properties class and asserts non-null on every documented component.

**First occurrence**: QA-003 (`BedrockProperties` expects `aws.bedrock.models`, yml has `aws.bedrock.text-model-id`).

---

## BP-004 — Prompt / resource key string drift between generator and caller

**Symptom**: `IllegalArgumentException("Prompt not found on classpath: prompts/…")` at runtime on first domain call.

**Root cause**: ai-engineer creates `prompts/data/nlp/sentiment.md`; backend-engineer hardcodes the key `"data/nlp_analyze.md"` in a service. Both agents are internally consistent; neither read the other's source of truth.

**Prevention (contract)**:
1. Architect publishes a registry of prompt keys (e.g. `_workspace/01_architect_prompts.md`) as source of truth, with stable IDs. Implementers reference enum/constant — never raw strings.
2. Introduce `enum PromptKey { NLP_SENTIMENT("data/nlp/sentiment.md"), … }`; services reference `PromptKey.NLP_SENTIMENT`, not string literals.
3. Startup validation: `PromptLoader` iterates all `PromptKey` values and asserts each resolves to a classpath resource.

**First occurrence**: QA-004 (`NlpAnalysisService` → `"data/nlp_analyze.md"` missing).

---

## BP-005 — DB schema written by architect/backend, SQL written by AI/retriever, diverged

**Symptom**: SQL errors at runtime — "column does not exist" / "type mismatch". Flyway `validate` does not catch because JPA validate only checks columns referenced by `@Column`, not JdbcTemplate-issued SQL.

**Root cause**: `knowledge_chunks` migration (backend-engineer) has 6 columns + BIGSERIAL id. AI retriever SQL (ai-engineer) references 9 columns and a UUID id. Both agents read their own "source of truth" (architect's data-model vs AI's DDL sketch) without cross-referencing.

**Prevention (contract)**:
1. Architect owns **all** DDL definitions. `_workspace/03_ai_application_yml_snippet.yaml` and `03_ai_progress.md` should *reference* the migration, not re-declare columns.
2. JdbcTemplate-based code must ship with a `@DataJpaTest + @Sql` test that inserts a known row and reads it back — verifying each column exists.
3. When a table is queried via both JPA and native SQL, architect must enumerate the **complete** column set once; any additions require a new migration.

**First occurrence**: QA-005 (`knowledge_chunks`: missing `title`, `source_type`, `company_id`, `metadata`; UUID vs BIGSERIAL id mismatch).

---

## BP-006 — Environment variable documented but not plumbed through compose/runtime

**Symptom**: Backend uses default value for a setting the user explicitly set in `.env`. No error, just unexpected behavior.

**Root cause**: `application.yml` declares `${CORS_ALLOWED_ORIGINS:defaults}`; docker-compose `environment:` block does not forward `CORS_ALLOWED_ORIGINS`; `.env.example` doesn't list it. Three separate config surfaces that drift.

**Prevention (contract)**:
1. Single source of truth: architect defines **env contract table** per environment (local/docker/prod). CI script cross-checks (a) all `${VAR}` references in yml exist in `.env.example`, (b) all `.env.example` keys are either used in compose or flagged as "for app direct use only".
2. Add a startup `EnvironmentPostProcessor` that logs every config property Spring *actually* bound to, grouped by whether it came from env vs default.

**First occurrence**: QA-010 (`CORS_ALLOWED_ORIGINS` in yml, absent from compose + .env).

---

## BP-007 — SSE event payload inconsistency between emitter and consumer

**Symptom**: Streaming chat works for one turn but subsequent messages lose conversation context.

**Root cause**: Server emits `done` with usage JSON only; client expects `done` payload to include `contextId`. Neither side is wrong per its own internal contract; the contract between them was never written down.

**Prevention (contract)**:
1. Architect's OpenAPI spec must enumerate, per SSE event name, the exact JSON schema of `data:`. Today `ChatStreamChunk` only says "For done: final usage JSON" — insufficient.
2. Add server-side JSON schema assertion in a unit test: given a `done` chunk, parse `data` as JSON and assert required keys `{contextId, tokensIn, tokensOut}`.
3. Client-side defensive parse with logged warning when expected key is missing.

**First occurrence**: QA-006 (FE expects `payload.contextId` on `done`; server sends only `tokensIn/tokensOut`).

---

## BP-008 — CORS allowedHeaders=* combined with allowCredentials=true (W3C violation)

**Symptom**: Preflight requests fail in some browsers; Spring 6 may throw at bean init.

**Root cause**: Copy-paste of "allow-all" CORS config forgets that `Access-Control-Allow-Headers: *` is incompatible with `Access-Control-Allow-Credentials: true` — browsers require an explicit header list when credentials are enabled.

**Prevention (contract)**:
1. Architect ADR enumerates exact headers the frontend will send (today: `Authorization, Content-Type, X-Request-Id, Accept`). CORS config references this list as a constant.
2. Add a contract test that hits `OPTIONS` with `Origin` + `Access-Control-Request-Headers: authorization,content-type` and asserts `Access-Control-Allow-Credentials: true` plus header list contains both.

**First occurrence**: QA-008.

---

## BP-009 — Actuator endpoint enabled in yml but no exporter jar on classpath

**Symptom**: `/actuator/prometheus` returns 404 even though the yml lists `prometheus` in `management.endpoints.web.exposure.include`.

**Root cause**: `include` only enables the endpoint if the relevant `@Endpoint` bean is on the classpath. Missing `micrometer-registry-prometheus` dependency = no endpoint bean.

**Prevention (contract)**:
1. DevOps dependency checklist: every monitoring endpoint listed in yml must have a test that fetches `/actuator/<name>` and asserts 200 during CI.
2. Architect pairs pom deps with yml features in a shared `_workspace/01_architect_dependencies.md`.

**First occurrence**: QA-011 (`prometheus` exposed, `micrometer-registry-prometheus` missing).

---

## Cross-pattern observation: contract authority drift

Six of the nine patterns above share a root cause: **two agents each used their own workspace doc as source of truth**. The architect documents (`01_architect_*.md`) are supposed to be authoritative, but the implementer agents' own progress notes (e.g. `03_ai_progress.md` DDL for knowledge_chunks) accumulate unreviewed additions.

**Meta-prevention**:
- Any doc with a DDL / schema / property sketch that isn't `01_architect_*.md` must carry the header: *"This is a request to architect; not authoritative until merged into 01_architect_data_model.md."*
- QA's cross-comparison pass becomes part of the definition of done for every module handoff, not an end-of-phase gate.
