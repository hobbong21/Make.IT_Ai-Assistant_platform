# MaKIT — DevOps Runbook

**Author**: devops-engineer
**Date**: 2026-04-20

## 1. Local first-run

```bash
# From project root
./scripts/setup.sh
```

What it does:
1. Copies `.env.example` → `.env` if missing (exits so you can edit).
2. `docker-compose build` — builds backend (JDK 21 multi-stage) and frontend (Nginx) images.
3. `docker-compose up -d` — starts `database` (pgvector/pg15), `redis`, `backend`, `frontend`.
4. Polls `http://localhost:8083/actuator/health` up to 30 × 5s (150s total).

Access after startup:
- Frontend: http://localhost
- Backend:  http://localhost:8083
- Swagger:  http://localhost:8083/swagger-ui.html
- Postgres (dev override): `localhost:5432` user `makit_user`
- Redis (dev override):    `localhost:6379`

## 2. Port map

| Service  | Host port | Container port | Notes |
|---|---|---|---|
| frontend | 80   | 80   | Nginx + SPA + API proxy |
| backend  | 8083 | 8083 | Spring Boot |
| database | 5432 | 5432 | Only exposed in `docker-compose.override.yml` (dev) |
| redis    | 6379 | 6379 | Only exposed in `docker-compose.override.yml` (dev) |

## 3. Healthcheck endpoints

| Service  | Endpoint | Expected |
|---|---|---|
| backend  | `http://localhost:8083/actuator/health` | `{"status":"UP"}` |
| frontend | `http://localhost/healthz` | `ok` (200) |
| database | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | exit 0 |
| redis    | `redis-cli ping` | `PONG` |

## 4. Required `.env` keys for the team

- `DB_NAME`, `DB_USER`, `DB_PASSWORD` — Postgres credentials
- `JWT_SECRET` — ≥32 char random string (`openssl rand -base64 48`)
- `AWS_REGION` — default `ap-northeast-2`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — Bedrock + S3 access (skip in ECS — use task role)
- `S3_BUCKET` — default `makit-assets`

Compose fails loudly if `DB_PASSWORD` or `JWT_SECRET` is missing.

## 5. Troubleshooting

### Backend won't start — DB connection refused
- `docker-compose logs database | tail -50` — confirm `database system is ready to accept connections`.
- Verify DB healthcheck: `docker-compose ps` — `database` should show `(healthy)`.
- Check env: `docker-compose exec backend env | grep SPRING_DATASOURCE` matches `jdbc:postgresql://database:5432/makit`.

### Backend healthcheck fails (remains starting)
- `start_period` is 60s — Spring Boot cold start takes ~30-45s. Give it 2 min before investigating.
- `docker-compose logs backend | grep ERROR`.
- Low-memory host: check `JAVA_OPTS`. Default `-XX:MaxRAMPercentage=75.0` needs ≥512 MB container.

### Port conflicts
- Port 80 taken: `sudo lsof -i :80` (Linux/macOS) or `netstat -ano | findstr :80` (Windows). Stop the conflicting service or edit `docker-compose.yml` frontend ports.
- Port 8083/5432/6379 similar.

### pgvector extension missing
- If `CREATE EXTENSION vector` fails, confirm image is `pgvector/pgvector:pg15`, not vanilla `postgres:15-alpine`. Rebuild DB volume: `docker-compose down -v && docker-compose up -d`.

### Frontend shows API error
- Browser devtools → Network → failed request. Should hit `/api/...` relative path.
- `docker-compose exec frontend cat /etc/nginx/conf.d/default.conf` — confirm `proxy_pass http://backend:8083/`.
- Inside frontend container: `wget -qO- http://backend:8083/actuator/health`.

## 6. Inspecting container logs

```bash
# Tail all
docker-compose logs -f

# Single service
docker-compose logs -f backend
docker-compose logs -f --tail=200 database

# JSON log grep (backend emits structured JSON per architect spec)
docker-compose logs backend | grep '"level":"ERROR"'
```

Persistent log files: `./logs/` (bind-mounted to backend `/app/logs`).

## 7. ECS deploy (from local dev laptop)

```bash
export AWS_REGION=ap-northeast-2
export ECR_REGISTRY=<ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com
export ECS_CLUSTER=makit-cluster
export ECS_SERVICE=makit-service
./scripts/deploy-aws.sh            # tags with git SHA
./scripts/deploy-aws.sh v1.2.3     # explicit tag
```

Monitor via ECS console — events tab shows task state transitions.

## 8. Rollback

Find previous good revision:
```bash
aws ecs list-task-definitions --family-prefix makit-task --sort DESC | head
```

Roll back:
```bash
aws ecs update-service \
  --cluster makit-cluster \
  --service makit-service \
  --task-definition makit-task:<PREVIOUS_REVISION> \
  --region ap-northeast-2
```

Rollback trigger: healthcheck failing for >2 minutes, 5xx rate >5%, or critical alarm in CloudWatch.

## 9. Manual AWS setup TODOs (one-time)

Not automated by scripts — operator action required in AWS console or via Terraform:

- [ ] Create ECR repositories: `makit-backend`, `makit-frontend`
- [ ] Create ECS cluster `makit-cluster` (Fargate)
- [ ] Create task definition `makit-task` referencing both images
- [ ] Create ECS service `makit-service` behind ALB
- [ ] Create RDS PostgreSQL 15 with pgvector (or use docker compose for staging)
- [ ] Create ElastiCache Redis 7
- [ ] Create S3 bucket `makit-assets-<env>` with server-side encryption
- [ ] Create CloudWatch log group `/ecs/makit-backend`, `/ecs/makit-frontend`
- [ ] Create IAM roles per `05_devops_iam_policies.md`
- [ ] Create GitHub OIDC provider in IAM (trust for Actions)
- [ ] Populate Secrets Manager entries `makit/jwt-secret`, `makit/db-password`
- [ ] Register GitHub secrets `AWS_ROLE_ARN`, `ECR_REGISTRY`

## 10. Safety checklist before prod push

- [ ] No secrets in `.env.example` (only placeholders)
- [ ] `.env` in `.gitignore`
- [ ] Task definition uses `secrets:` (Secrets Manager), not `environment:` for JWT/DB credentials
- [ ] Container runs as non-root (`spring` user) — verified in `backend/Dockerfile`
- [ ] Image tagged with git SHA (`latest` alone is not enough for audit trail)

---

## 10. Incident Response

### When an alarm fires

SNS topic `makit-alerts-<env>` delivers to email. Every alarm contains a link
back to the CloudWatch console.

### Triage decision tree — 5xx spike

```
Backend 5xx-rate alarm
 │
 ├─ 1. CloudWatch dashboard  makit-<env>-overview
 │      Is latency also up?  Is request rate up?
 │
 ├─ 2. ECS service  makit-<env>-backend-svc
 │      Events tab → is the service struggling to place tasks?
 │      Running count == desired count?
 │      If no → task start failures (pull / secrets / memory).
 │
 ├─ 3. Task logs  /ecs/makit-backend
 │      Filter for "ERROR". Look for:
 │        - DataAccessException / HikariPool → DB issue → go to RDS
 │        - RedisConnectionException → go to Redis
 │        - BedrockException / ThrottlingException → go to Bedrock
 │
 ├─ 4. RDS  makit-<env>-postgres
 │      CPUUtilization, DatabaseConnections, FreeStorageSpace.
 │      If CPU pegged → check slow query log (Performance Insights in prod).
 │
 ├─ 5. ElastiCache  makit-<env>-redis
 │      EngineCPUUtilization, Evictions.
 │
 └─ 6. Bedrock
        Is cost alarm also firing? Are retries piling up?
        Consider circuit-breaking expensive models temporarily.
```

### Paging flow

| Severity | Example                                | Paging                         |
|----------|----------------------------------------|--------------------------------|
| P1       | 5xx > 10% OR /healthz failing > 5 min  | Page on-call + DevOps lead     |
| P2       | 5xx 1-10%, p95 > 2s, DB CPU > 80%      | Ticket + Slack to #makit-ops   |
| P3       | Single alarm, self-recovers < 5 min    | Ticket only                    |

### Common issues cheat-sheet

| Symptom                        | Likely cause                              | Mitigation                                         |
|--------------------------------|-------------------------------------------|----------------------------------------------------|
| 503s immediately after deploy  | Task healthcheck grace period too short   | Bump `health_check_grace_period_seconds` in ecs module |
| Slow 502s under load           | Backend Hikari pool exhausted             | Scale backend out; check long queries in PI         |
| 5xx spike with no log errors   | ALB target draining / deregistration      | Check target health; check `deregistration_delay`   |
| Intermittent DB timeouts       | RDS near storage / IOPS cap               | Scale storage (autoscaling up to max), then class   |
| Bedrock ThrottlingException    | Account TPM limit                         | Request quota increase; add retry/backoff           |

---

## 11. Backup & Restore

### RDS

- Automated daily snapshots — retention **7 days (dev/staging)**, **30 days (prod)**.
- Window 17:00-18:00 UTC (≈02:00-03:00 KST).
- Point-in-time recovery (PITR) available for the retention window.
- `deletion_protection = true` in prod.
- `copy_tags_to_snapshot = true`.

### Point-in-time recovery

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier makit-prod-postgres \
  --target-db-instance-identifier makit-prod-postgres-restored-$(date +%Y%m%d%H%M) \
  --restore-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --use-latest-restorable-time \
  --region ap-northeast-2
```

After restore, update Secrets Manager `makit/<env>/db-password` with the
restored master password (or re-use the same — the snapshot preserves it),
then point the ECS task def at the new endpoint via Terraform
(`rds_override_endpoint` follow-up — not yet modularized).

### ElastiCache

- Replication group (prod only) takes daily snapshots (`snapshot_retention_limit = 7`).
- Dev/staging single node: **no snapshot**; cache is treated as ephemeral.
- Restore via `aws elasticache create-replication-group --snapshot-name ...`.

### S3

- Versioning enabled on `makit-<env>-assets`.
- Noncurrent versions expire after 90 days.
- Recovery: list noncurrent versions with `aws s3api list-object-versions`,
  restore with `aws s3api copy-object --copy-source <bucket>/<key>?versionId=...`

### DR targets (aspirational; reconcile with Architecture)

| Target | Value |
|--------|-------|
| RPO    | 1 hour (PITR granularity) |
| RTO    | 2 hours (manual restore + redeploy) |

Cross-region DR is **not** set up. To enable: turn on RDS cross-region automated
backups, replicate ECR with cross-region pull-through, and provision a
cold-standby VPC in `ap-northeast-1`.

---

## 12. Scaling

### Horizontal (ECS)

Auto-scaling policies (target tracking on CPU 60%):

| Service   | min      | max (dev) | max (prod) |
|-----------|----------|-----------|------------|
| backend   | desired  | 3         | 6          |
| frontend  | desired  | 3         | 6          |

To adjust: edit `ecs_max_count_backend` / `ecs_max_count_frontend` in the
target env's tfvars and `terraform apply`. For different scaling signals
(latency, queue depth, Bedrock tokens-in-flight), add an
`aws_appautoscaling_policy` in `modules/ecs/main.tf`.

Rule of thumb — bump max if:
- Backend sustained CPU > 50% across > 80% of the day
- p95 latency > 1s at normal load

### Vertical (RDS)

- Storage autoscales up to `rds_max_allocated_storage_gb` automatically.
- Instance class change requires brief downtime unless multi-AZ — prefer
  off-hours. Change `rds_instance_class` and apply.
- Read replicas: not yet modularized. For bursty read workloads add
  `aws_db_instance` with `replicate_source_db = aws_db_instance.this.id`
  and route read queries in the app.

### Vertical (ElastiCache)

Prod: `node_type` change triggers replication group reshape; AWS does this
online but can cause brief failover. Schedule in low traffic.

---

## 13. Secret Rotation

Quarterly rotation policy. Schedule in the first week of Jan / Apr / Jul / Oct.

### JWT_SECRET (needs dual-validation window)

Rotation is NOT a drop-in replace — existing tokens are signed with the old
key. Use dual-validation:

1. Backend must support a secondary `JWT_SECRET_OLD` env var (validation falls
   back to it). Confirm this is deployed before rotating.
2. Promote current secret to `OLD` in Secrets Manager (new secret version).
3. Generate a new random value, write to `makit/<env>/jwt-secret`.
4. Add `JWT_SECRET_OLD` reference in ECS task def (secrets block) pointing at
   the OLD secret.
5. Deploy.
6. Wait > max token TTL (e.g., 24 h for access tokens, up to 30 d if refresh
   tokens are signed with the same key).
7. Remove the `_OLD` mapping, redeploy.

### DB password

```bash
aws secretsmanager put-secret-value \
  --secret-id makit/<env>/db-password \
  --secret-string "$(openssl rand -base64 40 | tr -d '+/=' | head -c 40)"

aws rds modify-db-instance \
  --db-instance-identifier makit-<env>-postgres \
  --master-user-password "$(aws secretsmanager get-secret-value \
    --secret-id makit/<env>/db-password \
    --query SecretString --output text)" \
  --apply-immediately

# Force new ECS deployment so tasks pull new secret
aws ecs update-service --cluster makit-<env>-cluster \
  --service makit-<env>-backend-svc --force-new-deployment
```

Tasks will reconnect with the new password on next deploy (secrets are
injected at task start, not refreshed at runtime).

### Redis AUTH token

Same pattern. `aws elasticache modify-replication-group` with `--auth-token`
and `--auth-token-update-strategy ROTATE` supports dual-token until
switchover — document this carefully.

### Bedrock / AWS credentials

None to rotate — task role assumes temporary credentials automatically.

---

## 14. Cost Controls

### Baseline

See `_workspace/06_devops_cost_estimate.md`.

### Monitoring

- **Bedrock daily cost alarm — REMOVED (PRR-043, v1)**. The previous
  `makit-<env>-bedrock-daily-cost` alarm referenced the
  `MaKIT/Bedrock/DailyCostUSD` custom metric, but the backend has no
  Micrometer → CloudWatch bridge, so the metric was never published and
  the alarm sat in `INSUFFICIENT_DATA` forever (masked by
  `treat_missing_data=notBreaching`). For v1 prod, cost visibility comes
  from **AWS Cost Explorer + AWS Budgets + Bedrock service usage reports**
  (see "Cost Explorer" and "AWS Budgets" below).
  **v1.2 backlog (TODO, backend-engineer)**: add
  `micrometer-registry-cloudwatch2` + a `CloudWatchConfig` bean that
  publishes `bedrock.cost.usd` under namespace `MaKIT/Bedrock` as
  `DailyCostUSD`. Once the publisher exists, re-add the alarm and dashboard
  widget in `modules/monitoring/main.tf`.
- **AWS Budgets** (PRIMARY cost guardrail for v1): set an account-wide
  monthly budget with 50% / 80% / 100% thresholds to `oncall@example.com`.
  *(Out of scope for Terraform — config in Billing Console.)*
- **Cost Explorer** (PRIMARY cost visibility for v1): enable hourly +
  resource-level granularity. Tag reports by `Project=MaKIT` +
  `Environment=...`. All Terraform resources carry these tags
  automatically via `default_tags`. Filter to Service=`Amazon Bedrock`
  for model spend.

### Identifying anomalies

1. Cost Explorer → filter `Project = MaKIT` → group by Service. Watch for
   Bedrock / NAT Gateway / RDS dominating unexpectedly.
2. CloudWatch **Billing** dashboard — `EstimatedCharges` metric.
3. S3 storage class analysis — if IA transition isn't saving, review
   lifecycle policy.

### Common fixes

| Finding                        | Action                                            |
|--------------------------------|---------------------------------------------------|
| Bedrock > budget               | Lower model tier (Sonnet → Haiku), cap token count |
| NAT Gateway egress dominant    | Add VPC interface endpoints for S3, Secrets, ECR   |
| RDS over-provisioned           | Right-size class + Savings Plan                   |
| ECS Fargate over-provisioned   | Switch frontend service to `FARGATE_SPOT`         |
| CloudWatch logs high           | Reduce retention; drop verbose log lines          |
