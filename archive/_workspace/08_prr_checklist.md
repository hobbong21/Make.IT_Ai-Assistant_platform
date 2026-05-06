# 08 — Operator "Ready to Deploy" Checklist

**Purpose**: a one-page checklist the user should walk through before running
`terraform apply -var-file=envs/prod.tfvars`. Each item is PASS / FAIL with a
one-line piece of evidence.

Legend:
- [x] PASS — static-verified, no action needed
- [ ] FAIL — blocker or major; fix before deploy
- [~] CHECK — caller must confirm live (data source / runtime-only)

---

## A. Will the backend build?

- [ ] **A1** Backend `pom.xml` contains `software.amazon.awssdk:bedrock` (control-plane SDK — required by `BedrockHealthIndicator`).
      Evidence: grep on `backend/pom.xml` shows only `bedrockruntime`, not `bedrock`. → **FAIL (PRR-001)**.
- [ ] **A2** Backend `pom.xml` contains `io.github.resilience4j:resilience4j-reactor` (required by `BedrockService.invokeTextStream` → `CircuitBreakerOperator`).
      Evidence: not present in pom.xml. → **FAIL (PRR-002)**.
- [x] **A3** Spring Boot Actuator starter present. → PASS (pom.xml:60-62).
- [x] **A4** `bedrockruntime` on async classpath for streaming. → PASS (pom.xml:128-131).
- [x] **A5** `micrometer-registry-prometheus` present for `/actuator/prometheus`. → PASS (pom.xml:65-68).

## B. Will the backend boot against prod RDS + Redis?

- [ ] **B1** `SPRING_DATASOURCE_URL` includes `?sslmode=require` so PG enforces TLS from `rds.force_ssl=1`.
      Evidence: `infra/terraform/modules/ecs/main.tf:169` is `jdbc:postgresql://${var.db_endpoint}/${var.db_name}` — no sslmode. → **FAIL (PRR-015)**.
- [ ] **B2** Prod Redis AUTH wired through `SPRING_DATA_REDIS_PASSWORD` env var, not `SPRING_REDIS_PASSWORD`.
      Evidence: ECS task def uses `SPRING_REDIS_PASSWORD`. → **FAIL (PRR-014)**.
- [ ] **B3** Prod Redis TLS enabled (`spring.data.redis.ssl.enabled=true`) — required by `transit_encryption_enabled=true`.
      Evidence: not set in any application-*.yml. → **FAIL (PRR-016)**.
- [x] **B4** `JWT_SECRET` injected from Secrets Manager + fail-fast check for length≥32 when profile starts with `prod`. → PASS (JwtTokenProvider.java:44-51).
- [x] **B5** `DB_PASSWORD` + `SPRING_DATASOURCE_PASSWORD` injected from Secrets Manager. → PASS (ecs/main.tf:177-178).
- [~] **B6** First-apply has run `CREATE EXTENSION IF NOT EXISTS vector;` against the new RDS. Terraform parameter group supports it; the SQL command itself must be run once post-apply. → **CHECK** (runbook §Prerequisites step 7).

## C. Will AWS access work?

- [ ] **C1** ECS Task Role has `bedrock:ListFoundationModels` for BedrockHealthIndicator.
      Evidence: `modules/iam/main.tf:80-82` only has `InvokeModel` + `InvokeModelWithResponseStream`. → **FAIL (PRR-025)** (degrades /actuator/health to DOWN).
- [x] **C2** ECS Task Role has `bedrock:InvokeModel[WithResponseStream]`. → PASS (iam/main.tf:80-82).
- [x] **C3** ECS Task Role has `s3:PutObject/GetObject/...` on the assets bucket. → PASS (iam/main.tf:93-106).
- [x] **C4** ECS Task Execution Role has `secretsmanager:GetSecretValue` on `makit/*`. → PASS (iam/main.tf:54-58).
- [x] **C5** ECS Task Role has `cloudwatch:PutMetricData` scoped to `MaKIT/Bedrock` + `MaKIT/App` namespaces. → PASS (iam/main.tf:124-135) — though no publisher exists today (see D3).
- [x] **C6** GitHub OIDC deploy role has ECR push + ECS update + PassRole + TF state R/W. → PASS (iam/main.tf:188-293).

## D. Monitoring — will alarms fire when they should?

- [x] **D1** ALB 5xx rate, ALB p95 latency, RDS CPU, RDS storage, ECS desired-vs-running — all use AWS-published metrics. → PASS.
- [ ] **D2** Redis CPU alarm uses a dimension value that matches the real metric.
      Evidence: prod sends ReplicationGroup id to `CacheClusterId` dimension — mismatch. → **FAIL (PRR-026, PRR-044)**.
- [ ] **D3** Bedrock daily-cost alarm has a metric publisher.
      Evidence: no code calls `PutMetricData`; no CloudWatch Micrometer registry bean. → **FAIL (PRR-043)**.
- [x] **D4** SNS topic + email subscriptions. → PASS.
- [~] **D5** Dashboard widgets visible after deploy; requires the alarm publisher (D3) for two widgets. → **CHECK** live.

## E. Frontend ↔ Backend SSE contract

- [x] **E1** Event types `delta`, `citation`, `done`, `error`, `ping` defined and emitted. → PASS.
- [x] **E2** `done` event carries `contextId` JSON. → PASS (ChatbotStreamController.injectContextId).
- [x] **E3** Server heartbeat every ≥15s. → PASS (Duration.ofSeconds(15)).
- [ ] **E4** Stream body subscribed exactly once.
      Evidence: `Flux.merge(events, heartbeat).takeUntilOther(body.ignoreElements())` re-subscribes body → double Bedrock call + double DB insert per chat turn. → **FAIL (PRR-006)**.
- [ ] **E5** FE `delta` parsing does not mis-JSON-parse plain token text.
      Evidence: `chatbot.js` JSON-parses every SSE data line; plain-text deltas that look numeric/JSON-like will be mis-handled. → **FAIL (PRR-007)** (minor-to-major depending on token distribution).

## F. Secret hygiene + fail-fast

- [x] **F1** Prod JWT_SECRET length check enforced (≥32 chars). → PASS.
- [x] **F2** DemoUserSeeder is not active under `prod` profile. → PASS.
- [x] **F3** RateLimitFilter bypasses non-auth paths (including health endpoints). → PASS.
- [x] **F4** No `.env` file committed to tree. → PASS (only `.env.example`).
- [x] **F5** No `System.out.println` in backend source. → PASS.
- [~] **F6** Secrets Manager rotation policy for `jwt-secret`, `db-password`, `redis-auth-token` is configured out-of-band. Terraform deliberately does not manage values (`ignore_changes=[secret_string]`). → **CHECK**: runbook §13 covers manual rotation procedure.

## G. CI/CD

- [x] **G1** Image tag `${{ github.sha }}` propagates from `build-and-push` to `deploy-*` via `needs.build-and-push.outputs.image_tag`. → PASS.
- [x] **G2** staging + prod use GitHub Environments with required reviewers. → PASS.
- [x] **G3** Prod uses `terraform plan -out=prod.plan` + `apply prod.plan`. → PASS.
- [x] **G4** Smoke test on dev deploy (`/healthz` polling). → PASS.
- [x] **G5** `backend-test.yml` uses `pgvector/pgvector:pg15`, matching prod. → PASS.

## H. Env vars the app expects vs what Terraform provides

| App-expected (application.yml placeholder) | Provided by ECS env/secrets? | Status |
|--------------------------------------------|------------------------------|:------:|
| `SPRING_PROFILES_ACTIVE`                   | env = "prod"                 | [x] |
| `SPRING_DATASOURCE_URL`                    | env, missing `?sslmode=require` | [ ] FAIL (B1) |
| `SPRING_DATASOURCE_USERNAME`               | env                          | [x] |
| `SPRING_DATASOURCE_PASSWORD`               | secret                       | [x] |
| `JWT_SECRET`                               | secret                       | [x] |
| `AWS_REGION`                               | env                          | [x] |
| `BEDROCK_ENABLED` (optional, default true) | not set → default true       | [x] |
| `S3_BUCKET`                                | env                          | [x] |
| `SPRING_REDIS_HOST`                        | env                          | [x] |
| `SPRING_REDIS_PORT`                        | env = "6379"                 | [x] |
| `REDIS_PASSWORD` / `SPRING_DATA_REDIS_PASSWORD` | secret under wrong name | [ ] FAIL (B2) |
| `CORS_ALLOWED_ORIGINS`                     | **NOT SET** → localhost default | [ ] FAIL (PRR-017) |
| `JWT_ISSUER`                               | not set → `https://makit.example.com` | [ ] MAJOR (PRR-018) |
| `JWT_AUDIENCE`                             | not set → `makit-web`        | [ ] MAJOR (PRR-018) |

---

## Summary

- **BLOCKERs (must fix before apply)**: A1, A2, B1, B2 — 4 items
- **MAJORs (will break a feature or safety layer)**: B3, C1, D2, D3, E4, E5, H: CORS, H: JWT_ISSUER, H: JWT_AUDIENCE — 9 items
- **CHECK-at-deploy items**: B6 (CREATE EXTENSION), F6 (rotation policy), D5 (dashboard widgets)

**Recommended order**:
1. Add the two missing pom.xml dependencies (PRR-001, PRR-002).
2. Fix ECS env block: add `?sslmode=require`, rename Redis password env var, add CORS / JWT_ISSUER / JWT_AUDIENCE.
3. Add `spring.data.redis.ssl.enabled: true` to prod config.
4. Add `bedrock:ListFoundationModels` to IAM Task Role.
5. Fix the SSE double-subscription bug.
6. Decide: remove the cost alarm, or add a publisher.
7. Rewrite Redis CPU alarm to target the correct dimension.
