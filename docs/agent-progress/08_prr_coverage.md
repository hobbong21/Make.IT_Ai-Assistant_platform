# 08 — PRR Coverage Matrix

**Purpose**: show what this PRR did and did NOT verify. The caller can choose to
run live smoke checks against the gaps.

## Verified statically (no execution)

| Area | How verified | Confidence |
|------|--------------|:---------:|
| pom.xml dependency inventory vs imports in new AI classes | grep + read | HIGH |
| BedrockHealthIndicator API usage (bedrock control-plane SDK) | Read + AWS SDK package knowledge | HIGH |
| BedrockService streaming Reactor operator usage | Read class, matched to artifact name | HIGH |
| Mock-mode wiring (`aws.bedrock.enabled=false` → MockBedrockService) | Cross-read `@ConditionalOnProperty` in Mock + real service + application.yml | HIGH |
| SSE event contract (`delta`/`citation`/`done`/`error`/`ping`) | Read enum + controller + FE consumer; matched shape | HIGH |
| SSE done contextId presence | Read engine + controller `injectContextId` + FE `payload.contextId` | HIGH |
| SSE heartbeat 15s | Read controller `Duration.ofSeconds(15)` | HIGH |
| SSE double-subscription bug (PRR-006) | Traced `body` refs in controller `Flux.merge(...).takeUntilOther(body.ignoreElements())` | HIGH |
| ECS task def env + secrets wiring | Read `modules/ecs/main.tf` against `application*.yml` placeholders | HIGH |
| Missing `?sslmode=require` vs `rds.force_ssl=1` | Read both | HIGH |
| Redis AUTH wiring mismatch (env name) | Read ECS secrets block + Spring property path | HIGH |
| Redis TLS client flag missing | Read `elasticache/main.tf` + Spring data redis yml | HIGH |
| CORS / JWT_ISSUER / JWT_AUDIENCE missing from ECS env | Read ECS block + application.yml placeholders | HIGH |
| `SPRING_PROFILES_ACTIVE` string (`prod` only, no `prod-aws`) | Read ECS main.tf line 167 | HIGH |
| IAM Task Role permissions (Bedrock/S3/SecretsManager/CloudWatch) | Read policy document | HIGH |
| Missing `bedrock:ListFoundationModels` | Read IAM module, cross-checked BedrockHealthIndicator call | HIGH |
| Security group graph (ALB→Backend→RDS/Redis) | Read network module | HIGH |
| RDS parameter group `rds.force_ssl=1` + pg_stat_statements + pgvector comment | Read rds module | HIGH |
| ElastiCache replication group vs single cluster branch; AUTH + TLS | Read elasticache module | HIGH |
| ECS ALB listener rules + target group health checks | Read ecs module | HIGH |
| ECS target group health check paths | Cross-referenced with actuator config + nginx assumption | MEDIUM (nginx not re-read this round) |
| Monitoring alarms metric names / namespaces | Read monitoring module | HIGH |
| Redis dimension mismatch for prod replication group | Inferred from AWS/ElastiCache docs | HIGH |
| Bedrock custom-metric absence of publisher | grep across backend for `PutMetricData`, `CloudWatchMeterRegistry`, `DailyCostUSD` → 0 | HIGH |
| CI/CD image-tag propagation, approvals, state keys | Read docker-publish.yml | HIGH |
| CI/CD backend-test uses pgvector/pgvector:pg15 | Read backend-test.yml | HIGH |
| JWT fail-fast length check | Read JwtTokenProvider.java | HIGH |
| DemoUserSeeder profile gating (no `prod`) | Read @Profile annotation | HIGH |
| RateLimitFilter path-scoped + health-bypass | Read `shouldNotFilter` + LIMITED_PATHS | HIGH |
| Logback structured-JSON for prod | Read logback-spring.xml | HIGH |
| Hygiene: System.out, .env, hardcoded passwords, TODOs | grep | HIGH |

## NOT verified — suggested post-fix live checks

| Area | Why skipped | Suggested live probe |
|------|-------------|----------------------|
| Bedrock real streaming against real Claude | Requires AWS credentials + billing | Spin up dev env → `curl -N -X POST /api/commerce/chatbot/stream` with a JWT; observe first-token-ms and total-ms Micrometer timers; confirm `delta` chunks arrive within 3s. |
| Prompt injection guard effectiveness | Regex coverage evaluated only in `_workspace/03_ai_prompt_versioning.md` + code read | Send 20 adversarial prompts (EN + KO) → verify `ai.prompt.flagged{pattern=*}` counters increment in `/actuator/prometheus`. |
| Fallback cascade Tier-2 → Tier-3 | Needs forced primary failure | Force primary circuit breaker open (chaos test), observe `BedrockInvocation.fallback=true` with `fallbackReason` in response. |
| RDS SSL handshake | Requires live DB | Once deployed, `openssl s_client -starttls postgres -connect <endpoint>:5432` + confirm JDBC connects. |
| Redis AUTH + TLS handshake | Requires live Redis | `redis-cli --tls -h <endpoint> -a <auth-token> PING` → `PONG`. |
| ALB health check flap caused by Bedrock DOWN | Requires deployed backend | Watch `/actuator/health` during warm-up; if BedrockHealthIndicator returns DOWN (due to PRR-025), the composite health is DOWN and ALB marks target unhealthy. |
| CloudWatch alarms reception | Requires deployed infra | Trigger a synthetic 5xx spike → confirm SNS email arrives. |
| Cost alarm functional | Depends on PRR-043 fix | After publisher added, confirm alarm state transitions from INSUFFICIENT_DATA to OK within 24h. |
| GitHub OIDC AssumeRole round-trip | Requires a merged PR to main | First CI run will show whether `AWS_ROLE_ARN` + OIDC provider + trust policy line up. |
| Pre-migration RDS state | Flyway migrations weren't re-read this round | Post-apply, `psql ... -c "\\dt"` → confirm expected 11 tables + pgvector extension. |
| Frontend SPA routes + nginx proxy headers | nginx.conf not re-read this round | Visit prod domain, inspect network tab for `/api/commerce/chatbot/stream` — headers should include `Cache-Control: no-transform`, `X-Accel-Buffering: no`. |
| Prompt versioning override | Not exercised this round | Set `aws.bedrock.rag.promptVariants.commerce/rag_system: v2` in env, restart, hit chat — inspect `bedrock.invoke{prompt_version=2.0}`. |
| Rate-limit filter real behavior | No mvn run | `for i in {1..15}; do curl -X POST /api/auth/login ...; done` → 11th request returns 429 with `Retry-After`. |

## Boundaries out of scope for this PRR

| Excluded | Reason | Prior check |
|----------|--------|-------------|
| Nginx↔Backend proxy | Verified in earlier QA rounds (`06_qa_report_round2.md`) | QA-M14 — actuator ACL |
| Frontend JS module path / imports | Checked in `04_frontend_progress.md`; design layer unchanged | — |
| Flyway migrations v1–v10 schema | Validated in `06_qa_report_round2.md` QA-005 | — |
| Docker compose local runtime | Ops round covered in backend-ops progress; this PRR focuses on AWS deploy | — |
| DefaultS3ImageUploader internals | Trusted from prior round since scope is prod deploy, not image gen correctness | — |

## Assumption log

- AWS SDK for Java 2.x `software.amazon.awssdk:bedrock` artifact exists under `aws-sdk-version=2.25.70` and has `BedrockClient` + `ListFoundationModelsResponse` — confirmed present in public Maven Central.
- `resilience4j-reactor:2.2.0` is published (matching the `resilience4j-spring-boot3` version already on classpath) — confirmed.
- Spring Boot 3.2 relaxed-binding translates `SPRING_DATA_REDIS_PASSWORD` env → `spring.data.redis.password`, not `SPRING_REDIS_PASSWORD`.
- RDS PostgreSQL 15 ships pgvector as a pre-built extension; `CREATE EXTENSION` is enough (no shared_preload_libraries change needed).
- ElastiCache publishes `EngineCPUUtilization` per `CacheClusterId` (node id) in namespace `AWS/ElastiCache`; for replication groups, the dimension value is the individual node id (e.g. `makit-prod-redis-001`), not the replication group id.
- ECS Container Insights publishes `DesiredTaskCount`/`RunningTaskCount` in `ECS/ContainerInsights` namespace when Container Insights is enabled (which it is in this module).
