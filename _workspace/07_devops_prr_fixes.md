# 07 — DevOps PRR Fixes

**Author**: devops-engineer
**Date**: 2026-04-21
**Phase**: Production Readiness Review — remediation round
**Input**: `_workspace/08_prr_report_2026-04-21.md`
**Scope**: Terraform IaC only (modules/ecs, modules/iam, modules/elasticache, modules/monitoring, root main/vars, env tfvars, runbook §14). No backend / frontend / AI changes.

---

## Summary of changes by PRR ID

| PRR ID  | Severity | Status | File(s) touched | Notes |
|---------|:--------:|:------:|-----------------|-------|
| PRR-014 | BLOCKER  | FIXED  | `modules/ecs/main.tf` | Renamed Redis AUTH secret env from `SPRING_REDIS_PASSWORD` → `SPRING_DATA_REDIS_PASSWORD` (Spring Boot 3 relaxed binding target). Kept `SPRING_REDIS_PASSWORD` + `REDIS_PASSWORD` as aliases for defense-in-depth. |
| PRR-015 | BLOCKER  | FIXED  | `modules/ecs/main.tf` | Appended `?sslmode=require&prepareThreshold=0` to `SPRING_DATASOURCE_URL`. `rds.force_ssl=1` was already present in `modules/rds/main.tf:65-69` — verified. |
| PRR-016 | MAJOR    | NOTED  | (backend+devops joint) | `spring.data.redis.ssl.enabled=true` for prod must be set on the backend side (application-prod-aws.yml). DevOps injects correct env names; backend owns the Spring YAML flag. Out of DevOps scope per PRR report. |
| PRR-017 | MAJOR    | FIXED  | `modules/ecs/main.tf`, `modules/ecs/variables.tf`, `variables.tf`, `envs/*.tfvars` | Added `CORS_ALLOWED_ORIGINS` env var, wired via new `cors_allowed_origins` tfvar (default `https://your-domain.com`). |
| PRR-018 | MAJOR    | FIXED  | `modules/ecs/main.tf`, `modules/ecs/variables.tf`, `variables.tf`, `envs/*.tfvars` | Added `JWT_ISSUER` + `JWT_AUDIENCE` env vars. Defaults per env in tfvars. |
| PRR-019 | MINOR    | FIXED  | `modules/ecs/main.tf` | `SPRING_PROFILES_ACTIVE` for prod now = `"prod,prod-aws"` (activates the AWS-specific overlay). Non-prod unchanged. |
| PRR-020 | MINOR    | FIXED  | `modules/ecs/main.tf`, `modules/ecs/variables.tf`, `main.tf` | Added `redis_port` variable; task-def reads from `module.elasticache.port` output, no longer hardcoded `"6379"`. Backward compatible (default 6379). |
| PRR-025 | MAJOR    | FIXED  | `modules/iam/main.tf` | Added `BedrockList` statement granting `bedrock:ListFoundationModels` on `*` to the Task Role. Unblocks `BedrockHealthIndicator`. |
| PRR-026 | MAJOR    | FIXED  | `modules/elasticache/outputs.tf`, `modules/monitoring/main.tf`, `modules/monitoring/variables.tf`, `main.tf` | Exposed new `node_ids` output from elasticache module (set of `CacheClusterId` values). Replaced single Redis CPU alarm with `for_each` loop creating one alarm per node. Dashboard widget keeps using `redis_cluster_id` (replication group id is acceptable for memory%/CPU widgets that aggregate). |
| PRR-043 | MAJOR    | FIXED (Option 1) | `modules/monitoring/main.tf`, `modules/monitoring/variables.tf`, `_workspace/05_devops_runbook.md` §14 | Removed `bedrock_daily_cost` alarm and the `Bedrock tokens & cost` dashboard widget. `bedrock_daily_cost_usd_threshold` variable kept for backward compatibility (marked DEPRECATED in description). Runbook §14 updated: AWS Cost Explorer + Budgets are the primary cost guardrail for v1. Added v1.2 backlog TODO for `micrometer-registry-cloudwatch2` publisher. |
| PRR-058 | MINOR    | FIXED  | `modules/monitoring/main.tf` | Dashboard JSON widgets re-balanced after the cost widget removal; Redis widget now spans full width (w=24) at y=12. Verified no dangling commas. |

---

## Files touched

| Path | Change |
|------|--------|
| `infra/terraform/modules/ecs/main.tf` | env + secrets block rewritten: new URL, new/renamed env vars, new/renamed secret names with aliases. |
| `infra/terraform/modules/ecs/variables.tf` | Added `redis_port`, `cors_allowed_origins`, `jwt_issuer`, `jwt_audience`. |
| `infra/terraform/modules/iam/main.tf` | Added `BedrockList` statement on task inline policy. |
| `infra/terraform/modules/elasticache/outputs.tf` | Added `node_ids` output (set of CacheClusterId values). |
| `infra/terraform/modules/monitoring/main.tf` | Redis CPU alarm → for_each per node. Removed Bedrock cost alarm. Removed Bedrock dashboard widget and widened Redis widget. |
| `infra/terraform/modules/monitoring/variables.tf` | Added `redis_node_ids`. Marked `bedrock_daily_cost_usd_threshold` as DEPRECATED (kept for backcompat). |
| `infra/terraform/main.tf` | Passed `redis_port`, `cors_allowed_origins`, `jwt_issuer`, `jwt_audience` into `ecs` module; passed `redis_node_ids` into `monitoring` module. |
| `infra/terraform/variables.tf` | Added root-level `cors_allowed_origins`, `jwt_issuer`, `jwt_audience`. |
| `infra/terraform/envs/prod.tfvars` | Added `cors_allowed_origins`, `jwt_issuer`, `jwt_audience` with prod placeholders. Commented the now-vestigial `bedrock_daily_cost_usd_threshold`. |
| `infra/terraform/envs/staging.tfvars` | Same three app-config vars with staging placeholders. |
| `infra/terraform/envs/dev.tfvars` | Same three app-config vars with dev defaults (localhost for CORS). |
| `_workspace/05_devops_runbook.md` §14 | Rewrote Cost Controls "Monitoring" subsection — AWS Cost Explorer + Budgets are primary; v1.2 backlog TODO for Micrometer → CloudWatch bridge. |

---

## Constraints observed

- No `terraform apply` / `terraform plan`.
- No changes under `backend/`, `frontend/`, `ai/`, `.claude/`.
- No new Terraform modules — only existing modules edited.
- Module output signatures kept stable: new outputs added (`node_ids`) but no renames; existing consumers keep working.
- `bedrock_daily_cost_usd_threshold` variable is preserved (deprecated) so tfvars files don't break.
- Secret env aliases (`SPRING_REDIS_PASSWORD`, `REDIS_PASSWORD`) kept alongside the canonical `SPRING_DATA_REDIS_PASSWORD` so any residual reader is still served.

---

## Open follow-ups (not in DevOps scope)

- **PRR-001 / 002** (backend): add `software.amazon.awssdk:bedrock` and `io.github.resilience4j:resilience4j-reactor` to `backend/pom.xml`.
- **PRR-006** (backend): `ChatbotStreamController` double-subscribe bug.
- **PRR-007** (backend or frontend): SSE `delta` JSON-parse hazard.
- **PRR-013** (backend): `UUID.fromString` fallback → throw 401.
- **PRR-016** (backend): set `spring.data.redis.ssl.enabled=true` in `application-prod-aws.yml`.
- **PRR-042** (backend): `SPRING_PROFILES_ACTIVE=mock`, `AWS_BEDROCK_ENABLED=false` in `backend-test.yml`.
- **PRR-043 v1.2** (ai/backend): `micrometer-registry-cloudwatch2` publisher for Bedrock cost.
- **PRR-047** (config): pick a real threshold for Bedrock daily cost (relevant only once v1.2 publisher ships).
- **PRR-048 / 052 / 053** (backend): secret hygiene / logback redaction.
- **PRR-057 / 058** (ai/frontend): TODO markers and FE demo password visibility.

Verification needed on next operator pass:
- Confirm ACM cert ARN and real public domain are populated in `prod.tfvars` (still contains `REPLACE-*` placeholders).
