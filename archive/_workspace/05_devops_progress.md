# 05 — DevOps Progress

**Author**: devops-engineer
**Date**: 2026-04-20
**Phase**: Infra scaffolding complete, no containers built yet (backend code pending)

## Files created

- `backend/Dockerfile` — JDK 21 multi-stage → JRE 21 Alpine runtime, non-root `spring` user, HEALTHCHECK on 8083
- `nginx.conf` — extracted from inline heredoc; `/api/` → backend:8083, SSE with `proxy_buffering off`, SPA fallback, 7d static cache, `/healthz`
- `docker-compose.override.yml` — local dev (postgres/redis host-exposed, debug log level, src bind-mount)
- `.env.example` — DB_*, JWT_SECRET, AWS_*, S3_BUCKET
- `.dockerignore` — excludes .git, .claude, _workspace, target, logs, etc.
- `.gitignore` — .env, logs/, target/, .idea, IDE junk, skill caches
- `.github/workflows/backend-test.yml` — PR gate: postgres+redis service containers, Java 21 Temurin, `mvn verify`, upload surefire
- `_workspace/05_devops_iam_policies.md` — 3 IAM roles (ECS execution, ECS task, GitHub OIDC)
- `_workspace/05_devops_runbook.md` — setup, healthchecks, troubleshooting, rollback, manual TODOs

## Files rewritten

- `Dockerfile` (root Nginx) — no inline heredoc, references `nginx.conf`, adds healthcheck
- `docker-compose.yml` — pgvector image, Redis service added, backend port 8083, `${VAR:?required}` fail-loud guards, `condition: service_healthy` for backend depends_on
- `scripts/setup.sh` — `.env` guard, build/up, 30×5s backend health poll on 8083, friendly URL summary
- `scripts/deploy-aws.sh` — parameterized via env vars, defaults git-SHA tag, ECR login → build+push both images → `aws ecs update-service --force-new-deployment`
- `.github/workflows/docker-publish.yml` — trigger on main push only; OIDC via `aws-actions/configure-aws-credentials@v4` + `AWS_ROLE_ARN` secret; build+push both with `${{ github.sha }}` and `latest`; ECS force redeploy

## Port map (host → container)

| Service  | Host | Container |
|---|---|---|
| frontend | 80   | 80   |
| backend  | 8083 | 8083 |
| database | 5432 | 5432 (dev only — override file) |
| redis    | 6379 | 6379 (dev only — override file) |

## Healthchecks

- backend: `wget /actuator/health \| grep '"status":"UP"'`
- frontend: `GET /healthz` returns `ok`
- database: `pg_isready`
- redis: `redis-cli ping`

All compose-level with `start_period` on backend (60s Spring cold start).

## .env keys the team must set

`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`.

Compose will refuse to start without `DB_PASSWORD` and `JWT_SECRET` (`${VAR:?required}`).

## Known TODO (manual AWS console / Terraform)

- Create ECR repos `makit-backend`, `makit-frontend`
- Create ECS cluster + task def + service (Fargate)
- Create RDS Postgres 15 with pgvector (or keep compose DB for staging)
- Create ElastiCache Redis 7
- Create S3 bucket `makit-assets-<env>`
- Create IAM roles per `05_devops_iam_policies.md` (3 roles)
- Register GitHub OIDC provider; attach trust to `makit-github-oidc-role`
- Populate Secrets Manager: `makit/jwt-secret`, `makit/db-password`
- Set GitHub Actions secrets: `AWS_ROLE_ARN`, `ECR_REGISTRY`

## Handoff / blocking

- No containers have been built or started per instructions (backend Java code not yet compiled).
- `backend/Dockerfile` will fail build until `backend/pom.xml` + `backend/src/` exist (backend-engineer scope).
- `nginx.conf` proxy pass targets assume backend service name `backend` on compose network — matches compose service.
- Backend port **8083** enforced everywhere (compose ports, Nginx proxy_pass, healthchecks, CI env, runbook).
- pgvector image `pgvector/pgvector:pg15` used in both compose and CI service containers to match `KnowledgeRetriever` vector storage requirement.
