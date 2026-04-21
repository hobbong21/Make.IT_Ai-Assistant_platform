# 02 — Backend Operations Readiness Progress

Phase: Ops Readiness (v1.0 hardening).
Owner: backend-engineer agent.
Date: 2026-04-20.

Six production blockers / improvements addressed. Nothing under `ai/**`,
frontend/, or infra/ was touched (per scope constraints). `mvn` was not run.

---

## 1. QA-M09 — Runtime demo-user seeding with real BCrypt

**Problem.** `V202604201208__seed_demo_user.sql` embedded a hard-coded BCrypt
hash. Any drift in `PasswordEncoder` cost / algorithm would silently break
login; the hash was also impossible to rotate without a migration.

**Fix.**
- **Deleted** `backend/src/main/resources/db/migration/V202604201208__seed_demo_user.sql`.
- **Created** `backend/src/main/java/com/humanad/makit/auth/DemoUserSeeder.java`:
  - `@Component @Profile({"dev","docker","mock"})` — NEVER runs under `prod`/`prod-aws`.
  - Listens to `ApplicationReadyEvent`; `@Transactional`.
  - Seeds two accounts (idempotent — `existsByEmailIgnoreCase` first):
    - `demo@Human.Ai.D.com` / `password123` → `ADMIN`
    - `marketer@example.com` / `password123` → `MARKETING_MANAGER`
  - Hashes via the same `BCryptPasswordEncoder(12)` bean used by
    `AuthServiceImpl`, so hashes are always compatible.
  - Logs `Seeded demo users: N` at INFO after each run.

**Test recommendations.**
- Integration test under `docker` profile: start app against Testcontainers
  Postgres, assert both users exist and login via `/api/auth/login` returns 200.
- Run app a second time → seeder logs `Demo user already present, skipping` for
  both e-mails, total seeded = 0.

---

## 2. QA-M05 — Real `S3ImageUploader`

**Problem.** `MockUploaderConfig` stub returned a data-URI — fine for demo,
unusable in production image pipelines.

**Fix.**
- **Created** `backend/src/main/java/com/humanad/makit/config/DefaultS3ImageUploader.java`:
  - `@Component @ConditionalOnProperty("aws.bedrock.s3.enabled", matchIfMissing=true)`
    plus `@ConditionalOnMissingBean(S3ImageUploader.class)` — so the `mock`
    profile's in-memory bean wins when active, and prod gets the real one.
  - Builds `S3Client` + `S3Presigner` from `BedrockProperties.region()` with
    `DefaultCredentialsProvider` (IAM role on ECS, env creds locally).
  - Key layout: `${assetPrefix}${keyPrefix}/${yyyy/MM/dd}/${UUID}.${ext}`.
  - Headers: `Content-Type` honored, `Cache-Control: public, max-age=31536000, immutable`.
  - Returns a presigned GET URL (7-day expiry) — chosen over requiring a
    public bucket; safer default.
  - Retries 2x on 5xx / 429; aborts on 4xx.
- Placed under `config/` (not `ai/bedrock/`) because the scope explicitly
  prohibits touching `ai/**`, and the `S3ImageUploader` interface already
  lives in `com.humanad.makit.ai.content` (authored by ai-engineer).

**Test recommendations.**
- Unit-test the extension-resolution switch (`image/png` → `png`, etc.).
- LocalStack integration test: upload a 1KB PNG, `HEAD` the key, assert
  `Cache-Control` and `Content-Type`; hit the presigned URL and verify 200.
- Chaos test: mock `S3Client` throws a 503 on first call → second call
  succeeds (retry path).

---

## 3. NEW — Auth rate-limiting (defense-in-depth)

**Problem.** Only nginx was rate-limiting auth endpoints. A
misconfigured ingress or a direct-to-backend call would leave `/api/auth/login`
open to brute force.

**Fix.**
- **Dependency** `com.bucket4j:bucket4j_jdk17-core:8.10.1` added to `pom.xml`.
- **Created** `backend/src/main/java/com/humanad/makit/auth/RateLimitFilter.java`:
  - `@Order(HIGHEST_PRECEDENCE + 10)` — runs after `RequestIdFilter`, before
    `JwtAuthenticationFilter`.
  - Applies only to `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`
    (returns `shouldNotFilter=true` otherwise).
  - Keyed on client IP (`X-Forwarded-For` first entry → `X-Real-IP` →
    `remoteAddr`).
  - Bucket: capacity / refill configurable via
    `security.rate-limit.auth.capacity` (default 10) and
    `security.rate-limit.auth.refill-period` (default `PT1M`).
  - Rejects with HTTP 429, header `Retry-After`, body
    `ApiErrorResponse{errorCode:"RATE_LIMITED", ...}`.

**v1 limitation / v1.1 upgrade path.**
In-memory `ConcurrentHashMap<String,Bucket>` — correct for a single backend
JVM. For ECS multi-task deployments a shared store is required (an attacker
hitting two tasks behind an ALB gets 2× the quota). Upgrade path:
`bucket4j_jdk17-redis` → `LettuceBasedProxyManager` backed by the existing
`spring-boot-starter-data-redis`. Tracked in
`_workspace/99_release_report.md` §6.

**Test recommendations.**
- MockMvc: 11 rapid `POST /api/auth/login` from same IP → 11th returns 429 with
  `Retry-After` header and `RATE_LIMITED` error code.
- Verify requests from a different IP are unaffected.
- Tune with `security.rate-limit.auth.capacity=1000` in tests that hit login
  many times.

---

## 4. NEW — Secrets Manager integration

Chose the "ECS injects secrets as env vars" approach (no code coupling to AWS
Secrets Manager SDK). See `_workspace/02_backend_secrets_integration.md` for
the operator guide.

**Code changes.**
- **Edited** `backend/src/main/java/com/humanad/makit/auth/JwtTokenProvider.java`:
  added fail-fast assertion — if any active profile starts with `prod` and the
  raw secret length < 32 chars, the bean construction throws
  `IllegalStateException("JWT_SECRET must be >= 32 chars when profile=prod")`.
  Logs the actual length (never the value) before throwing.
- **Created** `backend/src/main/resources/application-prod-aws.yml` — a thin
  slice on top of `prod` documenting that `DB_PASSWORD` / `JWT_SECRET` come
  from Secrets Manager via ECS task-def `secrets:` array.

**Test recommendations.**
- `JwtTokenProviderTest`: spin up an `ApplicationContextRunner` with
  `spring.profiles.active=prod` and `jwt.secret=too-short` → expect startup
  failure with exact message.

---

## 5. NEW — Structured JSON logging

**Fix.**
- **Dependency** `net.logstash.logback:logstash-logback-encoder:7.4` added.
- **Created** `backend/src/main/resources/logback-spring.xml`:
  - `dev`/`docker`/`mock`/`default` → coloured console with pattern
    `[%X{requestId}] [%X{userId}] logger - msg`.
  - `prod`/`prod-aws` → `LoggingEventCompositeJsonEncoder` emitting JSON with
    `timestamp` (UTC), `level`, `logger`, `thread`, `message`, full MDC,
    shortened stack traces (rootCauseFirst), and a static `application` tag.
- **Created** `backend/src/main/java/com/humanad/makit/common/LoggingMdcFilter.java`:
  - Runs last in the chain (after Security), copies the authenticated principal
    (the user UUID in our JWT) into `MDC["userId"]`, cleans up in `finally`.
  - `RequestIdFilter` already handles `MDC["requestId"]`.

**Test recommendations.**
- `spring.profiles.active=prod` boot → assert stdout line is valid JSON with
  required fields (`message`, `logger_name`, `level`, `@timestamp`).
- Hit an authenticated endpoint → assert the service's log line includes both
  `requestId` and `userId` MDC values.

---

## 6. NEW — Actuator hardening

**Edited** `application-prod.yml`:
- `management.endpoints.web.exposure.include: health,info,metrics,prometheus`
  (down from whatever default would otherwise leak `env`, `beans`, `mappings`).
- `management.endpoint.health.show-details: never` (previously
  `when_authorized` in `application.yml`; prod should reveal nothing to probes).
- `management.endpoint.health.probes.enabled: true` + explicit
  `health.livenessstate.enabled` / `readinessstate.enabled` so ECS / k8s can
  target `/actuator/health/liveness` and `/actuator/health/readiness`.

**Prometheus endpoint protection.** `/actuator/prometheus` is unauthenticated at
the Spring layer but restricted at the Nginx layer (existing `nginx.conf`
location block — confirmed with devops-engineer). Document this in the runbook
and do not change `SecurityConfig` further.

**Test recommendations.**
- `GET /actuator/health` → 200, body `{"status":"UP"}` with no
  `components`/`details` field under `prod`.
- `GET /actuator/env` → 404 under `prod` (endpoint not exposed).
- `GET /actuator/health/liveness` → 200 when app is running, 503 during
  shutdown.

---

## Profile / feature matrix

| Feature                          | default | dev | docker | mock | prod | prod-aws |
|----------------------------------|:------:|:---:|:------:|:----:|:----:|:--------:|
| DemoUserSeeder                   |   -    |  Y  |   Y    |  Y   |  -   |    -     |
| MockUploaderConfig (in-memory)   |   -    |  -  |   -    |  Y   |  -   |    -     |
| DefaultS3ImageUploader (real S3) |   Y    |  Y  |   Y    |  -   |  Y   |    Y     |
| RateLimitFilter                  |   Y    |  Y  |   Y    |  Y   |  Y   |    Y     |
| JWT length fail-fast             |   -    |  -  |   -    |  -   |  Y   |    Y     |
| Logback JSON console             |   -    |  -  |   -    |  -   |  Y   |    Y     |
| Actuator hardening               |   -    |  -  |   -    |  -   |  Y   |    Y     |

## Files touched

Created:
- `backend/src/main/java/com/humanad/makit/auth/DemoUserSeeder.java`
- `backend/src/main/java/com/humanad/makit/auth/RateLimitFilter.java`
- `backend/src/main/java/com/humanad/makit/config/DefaultS3ImageUploader.java`
- `backend/src/main/java/com/humanad/makit/common/LoggingMdcFilter.java`
- `backend/src/main/resources/application-prod-aws.yml`
- `backend/src/main/resources/logback-spring.xml`
- `_workspace/02_backend_ops_progress.md` (this file)
- `_workspace/02_backend_secrets_integration.md`

Edited:
- `backend/pom.xml` (added bucket4j + logstash-logback-encoder)
- `backend/src/main/java/com/humanad/makit/auth/JwtTokenProvider.java` (prod length check)
- `backend/src/main/resources/application-prod.yml` (rate-limit + actuator)

Deleted:
- `backend/src/main/resources/db/migration/V202604201208__seed_demo_user.sql`

## Open items / known limitations

- **Rate-limit store is per-JVM.** Swap for Redis-backed Bucket4j when ECS
  scales to > 1 task. v1.1 backlog.
- **No RateLimitFilter bypass for healthchecks/internal IPs.** Auth endpoints
  aren't called by probes so this is fine; revisit if an internal service
  starts hitting login.
- **No admin endpoint to force-rotate demo user passwords.** Ops must delete
  the row and let the seeder re-run, or restart with a clean DB.
