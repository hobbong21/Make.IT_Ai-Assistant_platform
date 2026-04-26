# 08 — PRR Round-2 Verification Report

**Author**: qa-engineer
**Date**: 2026-04-21
**Scope**: Targeted re-verification of BLOCKERs + MAJORs claimed fixed in
`02_backend_prr_fixes.md` and `07_devops_prr_fixes.md`.
**Method**: Static read/grep. No `mvn`, no `terraform plan`, no code changes.

---

## BLOCKER verification

### PRR-001 — `software.amazon.awssdk:bedrock` dependency — CONFIRMED FIXED

`backend/pom.xml:132-137`:
```xml
<dependency>
  <groupId>software.amazon.awssdk</groupId>
  <artifactId>bedrock</artifactId>
  <version>${aws.sdk.version}</version>
</dependency>
```
Uses the shared `${aws.sdk.version}` property (no hardcoded drift). Placed
adjacent to `bedrockruntime` / `s3`.

### PRR-002 — `resilience4j-reactor` dependency — CONFIRMED FIXED

`backend/pom.xml:150-155`:
```xml
<dependency>
  <groupId>io.github.resilience4j</groupId>
  <artifactId>resilience4j-reactor</artifactId>
  <version>${resilience4j.version}</version>
</dependency>
```
Uses shared `${resilience4j.version}` (= `2.2.0` per line 31). Co-located
with `resilience4j-spring-boot3`.

### PRR-014 — Redis env name (`SPRING_DATA_REDIS_PASSWORD`) — CONFIRMED FIXED

`infra/terraform/modules/ecs/main.tf:192-196`:
```hcl
# PRR-014 fix: Spring Boot 3 reads spring.data.redis.password → SPRING_DATA_REDIS_PASSWORD.
{ name = "SPRING_DATA_REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn },
# Legacy alias for anything still reading Boot 2 or REDIS_PASSWORD env.
{ name = "SPRING_REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn },
{ name = "REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn }
```
Canonical Boot-3 name present. Legacy aliases kept (defense-in-depth, no
harm).

### PRR-015 — RDS SSL in datasource URL + force_ssl — CONFIRMED FIXED

`infra/terraform/modules/ecs/main.tf:170-171`:
```hcl
{ name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://${var.db_endpoint}/${var.db_name}?sslmode=require&prepareThreshold=0" },
```
`infra/terraform/modules/rds/main.tf:66`:
```hcl
name  = "rds.force_ssl"
```
Parameter group enforces TLS; client URL negotiates TLS. Both sides aligned.

### PRR-016 — Redis SSL client enabled (backend) — CONFIRMED FIXED

`backend/src/main/resources/application-prod.yml:9-12`:
```yaml
data:
  redis:
    ssl:
      enabled: ${REDIS_SSL_ENABLED:true}
```
`backend/src/main/resources/application-prod-aws.yml:26-29`:
```yaml
data:
  redis:
    ssl:
      enabled: true
```
Default `true`, env-override path preserved for staging/local-without-TLS.

### PRR-006 (SSE double subscription) — CONFIRMED FIXED

`backend/src/main/java/com/humanad/makit/commerce/chatbot/ChatbotStreamController.java:56-74`:
- `chatbotService.chatStream(...)` is invoked **once** into `events`.
- `doOnTerminate` + `doOnCancel` flip a shared `AtomicBoolean completed`.
- `heartbeat` is a timer-only `Flux.interval` gated by `takeWhile(i -> !completed.get())`.
- Final return is `events.mergeWith(heartbeat)` — **no** `takeUntilOther(body.ignoreElements())`.
Side-effect count now: 1 Bedrock invocation + 1 user-message persistence per
request. Grep for `takeUntilOther` / `body.ignoreElements()` in this file:
zero matches.

---

## MAJOR verification

### PRR-017 — `CORS_ALLOWED_ORIGINS` env var — CONFIRMED FIXED

`infra/terraform/modules/ecs/main.tf:183`:
```hcl
{ name = "CORS_ALLOWED_ORIGINS", value = var.cors_allowed_origins },
```
Wired via new `cors_allowed_origins` tfvar (root + per-env tfvars).

### PRR-018 — `JWT_ISSUER` / `JWT_AUDIENCE` env vars — CONFIRMED FIXED

`infra/terraform/modules/ecs/main.tf:185-186`:
```hcl
{ name = "JWT_ISSUER", value = var.jwt_issuer },
{ name = "JWT_AUDIENCE", value = var.jwt_audience }
```

### PRR-025 — IAM `bedrock:ListFoundationModels` — CONFIRMED FIXED

`infra/terraform/modules/iam/main.tf:93-99`:
```hcl
statement {
  sid       = "BedrockList"
  actions   = ["bedrock:ListFoundationModels"]
  resources = ["*"]
}
```
Granted to the Task Role → `BedrockHealthIndicator` will now return UP.

### PRR-026 — Per-node Redis CPU alarm + `node_ids` output — CONFIRMED FIXED

`infra/terraform/modules/elasticache/outputs.tf:16-17`:
```hcl
output "node_ids" {
  description = "Set of CacheClusterId values ..."
```
`infra/terraform/modules/monitoring/main.tf:143-158`:
```hcl
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  for_each            = var.redis_node_ids
  alarm_name          = "${local.alarm_prefix}-redis-cpu-high-${each.value}"
  ...
  dimensions          = { CacheClusterId = each.value }
}
```
And `infra/terraform/main.tf:191`: `redis_node_ids = module.elasticache.node_ids`.
Wiring end-to-end OK.

### PRR-043 — Bedrock cost alarm + widget removed + runbook updated — CONFIRMED FIXED

- `aws_cloudwatch_metric_alarm.bedrock_*` resource: **not present** in `modules/monitoring/main.tf` (grep for `bedrock.*alarm` returns only a doc comment at line 215 explaining the removal).
- `bedrock_daily_cost_usd_threshold` variable kept (deprecated) per comment at `variables.tf:64-66` — backcompat safety, no live usage.
- Runbook §14 updated (`_workspace/05_devops_runbook.md:366-384`): Cost Explorer + AWS Budgets = primary v1 guardrail; `micrometer-registry-cloudwatch2` explicitly deferred to v1.2.

---

## Additional quick checks

- **`SPRING_PROFILES_ACTIVE`** — `modules/ecs/main.tf:168`:
  ```hcl
  { name = "SPRING_PROFILES_ACTIVE", value = var.environment == "prod" ? "prod,prod-aws" : var.environment },
  ```
  Prod activates both `prod` and `prod-aws`. CONFIRMED FIXED (resolves PRR-019).

- **Redis SSL YAML indentation** — both files place `ssl.enabled` under `spring.data.redis`. Hierarchy correct.

---

## New issues introduced by the fixes

None detected.

Minor observations (not regressions):
1. `SPRING_REDIS_PASSWORD` alias kept alongside canonical `SPRING_DATA_REDIS_PASSWORD`. Harmless but leaves two env vars reading the same secret — cleanup candidate for v1.1.
2. `bedrock_daily_cost_usd_threshold` tfvar retained as deprecated. Consumers can still set it but it is a no-op. Flag for v1.2 removal.
3. The SSE heartbeat `takeWhile` is evaluated on each 15 s tick — on client disconnect the heartbeat terminates on the next tick (≤15 s lag). Expected, matches the original 15 s cadence.

---

## Summary

**Count**: 11 confirmed / 0 partial / 0 still-broken.

Specifically:
- 5/5 BLOCKERs confirmed fixed: PRR-001, PRR-002, PRR-014, PRR-015, PRR-016 (+ PRR-006 SSE double-subscribe, PRR-report treated as blocker).
- 5/5 MAJORs confirmed fixed: PRR-017, PRR-018, PRR-025, PRR-026, PRR-043.
- Bonus: PRR-019 (profile activation `prod,prod-aws`) also confirmed in ECS task def.

**New regressions**: None.

**Recommendation**: **GO** for production deployment — conditional on the
remaining pre-deploy human actions listed below. All compile-breaking and
runtime-broken blockers are resolved statically. `mvn compile` and
`terraform plan` should both succeed (not executed here by constraint).

**Remaining pre-deploy human actions** (ordered):

1. Run `mvn -pl backend -am clean compile` to confirm the two new
   dependencies resolve on the local Maven mirror (artifact versions fall out
   of shared properties; low risk, but must be exercised before release).
2. Run `terraform -chdir=infra/terraform plan -var-file=envs/prod.tfvars` and
   inspect the diff for the ECS task-def re-register + IAM policy update +
   monitoring alarm re-shaping (`for_each` over `redis_node_ids`). Expect
   create/destroy on the old single `redis_cpu` alarm.
3. Populate real values in `envs/prod.tfvars` — still contains
   `REPLACE-*` placeholders for ACM cert ARN, domain, CORS origin, JWT
   issuer/audience (`cors_allowed_origins`, `jwt_issuer`, `jwt_audience`).
4. Seed `redis_auth_token_secret_arn` in Secrets Manager (AUTH token value)
   before first ECS rollout with the renamed env var.
5. Smoke-test `/actuator/health/bedrock` post-deploy — validates PRR-001
   (compile), PRR-025 (IAM), and Bedrock client wiring in one probe.
6. Verify SSE `/api/commerce/chatbot/stream` under two concurrent clients:
   confirm single `ChatMessage` row + single Bedrock invocation per request
   (regression canary for PRR-006).
