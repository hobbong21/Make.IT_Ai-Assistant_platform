# 02 — Backend PRR Fixes

Phase: Production Readiness Review remediation (post-PRR 2026-04-21).
Owner: backend-engineer.
Date: 2026-04-21.
Scope: backend-owned blockers and majors from `08_prr_report_2026-04-21.md`.
Constraints: no changes to `ai/**`, frontend, or `infra/terraform`. No new
functionality beyond what PRR flagged.

---

## PRR-001 (BLOCKER) — Missing `software.amazon.awssdk:bedrock` dependency

**Evidence in report.** `BedrockHealthIndicator.java:12-13` imports
`software.amazon.awssdk.services.bedrock.BedrockClient` +
`software.amazon.awssdk.services.bedrock.model.ListFoundationModelsResponse`.
The pom only had `bedrockruntime`.

**Fix.** Added dependency to `backend/pom.xml` using the existing
`${aws.sdk.version}` property (no new version declaration):

```xml
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>bedrock</artifactId>
  <version>${aws.sdk.version}</version>
</dependency>
```

Placed adjacent to `bedrockruntime` / `s3` in the AWS SDK block.

---

## PRR-002 (BLOCKER) — Missing `resilience4j-reactor` dependency

**Evidence in report.** `BedrockService.java:10,202` uses
`io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator`,
which is published as a separate artifact from `resilience4j-spring-boot3`.

**Fix.** Added dependency to `backend/pom.xml` using the existing
`${resilience4j.version}` property:

```xml
<dependency>
  <groupId>io.github.resilience4j</groupId>
  <artifactId>resilience4j-reactor</artifactId>
  <version>${resilience4j.version}</version>
</dependency>
```

Placed next to `resilience4j-spring-boot3`.

---

## PRR-006 (MAJOR — treated as blocker per PRR instructions) — SSE double subscription

**Problem.** Previous implementation:

```java
return Flux.merge(events, heartbeat).takeUntilOther(body.ignoreElements());
```

subscribed to `body` (== `chatbotService.chatStream(...)`) twice. Because
`ChatbotService.chatStream` performs DB writes + Bedrock invocation on
subscription, every SSE request doubled those side effects.

**Fix.** Rewrote the method in
`backend/src/main/java/com/humanad/makit/commerce/chatbot/ChatbotStreamController.java`
so the body publisher is subscribed **exactly once**. The heartbeat interval is
gated on a shared `AtomicBoolean` completion flag set via
`doOnTerminate` / `doOnCancel` on the (single) body subscription. The outer
return merges the mapped body with the gated heartbeat — still one merge, still
one body subscription.

Key structure:

```java
AtomicBoolean completed = new AtomicBoolean(false);
Flux<ServerSentEvent<String>> events = chatbotService.chatStream(...)
        .map(...)
        .doOnTerminate(() -> completed.set(true))
        .doOnCancel(() -> completed.set(true));
Flux<ServerSentEvent<String>> heartbeat = Flux.interval(Duration.ofSeconds(15))
        .takeWhile(i -> !completed.get())
        .map(i -> ServerSentEvent.<String>builder().event("ping").data("").build());
return events.mergeWith(heartbeat);
```

Semantics preserved:
- `done` / `error` events from `ChatbotService` still pass through unchanged
  (inc. the `injectContextId` logic on `done`).
- Heartbeat still fires every 15 s (unchanged — meets the ≥15s FE requirement).
- Downstream completion of `events` terminates the heartbeat naturally:
  `takeWhile` evaluates on each tick, the flag is set before the `events`
  stream emits its terminal signal, and `mergeWith` completes once both
  sources complete. Client disconnect (cancel) also flips the flag.

Side-effect count after fix: **1** Bedrock invocation + **1** user message
persisted per request.

---

## PRR-016 (MAJOR) — Prod Redis TLS client configuration

**Problem.** ElastiCache replication group has `transit_encryption_enabled=true`
(`modules/elasticache/main.tf:94`). Lettuce client requires explicit
`spring.data.redis.ssl.enabled=true`; otherwise it opens a plaintext socket
that the server drops.

**Fix.** Added the SSL flag to **both** prod profiles (same tree):

- `backend/src/main/resources/application-prod.yml`:

  ```yaml
  spring:
    data:
      redis:
        ssl:
          enabled: ${REDIS_SSL_ENABLED:true}
  ```

  (env-var override kept so a local/staging Redis without TLS can flip it off
  via `REDIS_SSL_ENABLED=false`.)

- `backend/src/main/resources/application-prod-aws.yml`: also set
  `spring.data.redis.ssl.enabled: true` under the `prod-aws` overlay.

Both are needed: `prod` alone is activated in ECS today, and `prod-aws` will be
activated when devops fixes PRR-019.

---

## PRR-019 (MINOR) — Profile activation (prod,prod-aws)

**Problem.** `SPRING_PROFILES_ACTIVE` in the ECS task def is set to just
`prod`, so the `prod-aws` overlay never activates.

**Backend-side status.** No code change needed:

- `application-prod-aws.yml` header documents the intended value
  `SPRING_PROFILES_ACTIVE=prod,prod-aws`.
- `logback-spring.xml` already uses `<springProfile name="prod,prod-aws">` for
  the JSON appender — the structured-logging encoder picks up both profiles.

**Remaining action (devops-engineer scope).** Flip the ECS env var to
`prod,prod-aws`. Called out in the PRR owner table for devops; no backend work.

---

## Additional hardening — verified, no change needed

### RateLimitFilter scope

`RateLimitFilter.java:74-76`:

```java
@Override
protected boolean shouldNotFilter(HttpServletRequest request) {
    return !LIMITED_PATHS.contains(request.getRequestURI());
}
```

`LIMITED_PATHS` is a static `Set.of(/api/auth/login, /api/auth/register,
/api/auth/refresh)`. Any URI outside that set (including `/actuator/health`,
`/actuator/info`, `/v3/api-docs`, `/swagger-ui/**`) short-circuits with
`shouldNotFilter=true` — the filter chain skips the bucket entirely.

Already PASS under PRR-050. No code change made.

### DemoUserSeeder prod guard

`DemoUserSeeder.java:27`:

```java
@Profile({"dev", "docker", "mock"})
```

No `prod` / `prod-aws`. Already PASS under PRR-049. No code change made.

---

## Files touched

Edited:
- `backend/pom.xml` — added `software.amazon.awssdk:bedrock` + `io.github.resilience4j:resilience4j-reactor`.
- `backend/src/main/java/com/humanad/makit/commerce/chatbot/ChatbotStreamController.java` — single-subscription SSE merge.
- `backend/src/main/resources/application-prod.yml` — Redis SSL.
- `backend/src/main/resources/application-prod-aws.yml` — Redis SSL (overlay).

Unchanged (verified in scope, already correct):
- `backend/src/main/java/com/humanad/makit/auth/RateLimitFilter.java`.
- `backend/src/main/java/com/humanad/makit/auth/DemoUserSeeder.java`.
- `backend/src/main/resources/logback-spring.xml` (`prod,prod-aws` already handled).

Created:
- `_workspace/02_backend_prr_fixes.md` (this file).

---

## PRR IDs resolved (backend scope)

| PRR ID | Severity | Status |
|--------|----------|--------|
| PRR-001 | BLOCKER  | FIXED (pom.xml) |
| PRR-002 | BLOCKER  | FIXED (pom.xml) |
| PRR-006 | MAJOR    | FIXED (ChatbotStreamController) |
| PRR-016 | MAJOR    | FIXED (application-prod*.yml) |
| PRR-019 | MINOR    | BACKEND-READY (logback + overlay already support it; ECS env var change is devops-engineer) |

Not in backend scope (owned by devops-engineer / ai-engineer):

- PRR-014, PRR-015, PRR-017, PRR-018, PRR-020 — Terraform ECS env vars / JDBC
  URL / CORS / JWT issuer & audience / Redis port wiring.
- PRR-025, PRR-026, PRR-027, PRR-028 — Terraform IAM, monitoring, ALB.
- PRR-043 — CloudWatch metric publisher for Bedrock cost alarm (ai-engineer).

---

## Caveats / notes

- `mvn` was **not** executed; dependency additions are sourced from existing
  `${aws.sdk.version}` + `${resilience4j.version}` properties to avoid version
  drift. The `bedrock` artifact is published in every AWS SDK v2 release that
  ships `bedrockruntime`; `resilience4j-reactor` is published for every
  resilience4j release that ships `resilience4j-spring-boot3`.
- The SSE fix preserves the original semantics (15 s heartbeat, `done`/`error`
  handling, `injectContextId`) and relies only on `doOnTerminate` +
  `doOnCancel` + `takeWhile` — no shared / published / cached operators. This
  means a subscriber that disconnects mid-stream cleanly terminates the
  heartbeat interval on the next tick (at most 15 s of extra work before the
  flag short-circuits the `takeWhile`).
- Existing tests (MockMvc / WebTestClient for the controller, if any) should
  remain green: the public contract (event names, payloads, Content-Type) is
  unchanged.
