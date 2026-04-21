# MaKIT — DevOps Operations Readiness Progress

**Author**: devops-engineer
**Date**: 2026-04-20
**Phase**: Operations Readiness

## What was built

### Terraform IaC (`infra/terraform/`)

Replaces the manual 7-step AWS setup from runbook §9 with a modular,
per-environment Terraform project.

| Module          | Purpose                                                                 |
|-----------------|-------------------------------------------------------------------------|
| `network`       | VPC, 3 AZs, public + private subnets, IGW, NAT (1 or 3), route tables, security groups (alb / ecs-backend / ecs-frontend) |
| `ecr`           | 2 ECR repos (backend, frontend), immutable tags, scan-on-push, lifecycle keep-last-10 + expire-untagged-7d |
| `secrets`       | Secrets Manager entries (`makit/<env>/jwt-secret`, `db-password`, `redis-auth-token`) with optional `random_password` on first apply; `ignore_changes` for rotation out-of-band |
| `iam`           | Task Execution Role, Task Role (Bedrock + S3 + Logs + PutMetricData scoped to MaKIT/* namespaces), GitHub OIDC deploy role with ECR / ECS / IAM PassRole / TF state permissions |
| `s3`            | `makit-<env>-assets` bucket: versioning, SSE-S3, public access block, lifecycle → STANDARD_IA at 30d, noncurrent expire 90d, bucket policy denies unencrypted + insecure transport |
| `rds`           | PostgreSQL 15 + custom parameter group (pg_stat_statements, `rds.force_ssl=1`), gp3 storage w/ autoscaling, encrypted, 7/30d backup, multi-AZ + PI for prod, deletion protection in prod, `ignore_changes=[password]` |
| `elasticache`   | Redis 7: single node for dev/staging, replication group (multi-AZ failover + at-rest/transit encryption + AUTH) for prod, allkeys-lru param group |
| `ecs`           | Fargate cluster (Container Insights on), ALB + HTTP/HTTPS listeners (HTTPS only if `acm_certificate_arn`), target groups with /actuator/health and /healthz checks, listener rule `/api/*` → backend, task definitions with env + `secrets:` injection, services, target-tracking CPU autoscaling 60% |
| `monitoring`    | SNS alerts topic with email subscriptions, alarms (5xx rate, p95 latency, RDS CPU, RDS storage, Redis CPU, ECS count mismatch, Bedrock daily cost), CloudWatch dashboard (request rate, latency p50/p95/p99, status breakdown, RDS CPU/IOPS, Redis memory, Bedrock tokens + cost) |

### CI/CD

`.github/workflows/docker-publish.yml` rewritten:

1. `build-and-push` (build & push images, passes `github.sha` as output)
2. `deploy-dev` (terraform init + apply with image tag override + ALB smoke test)
3. `deploy-staging` (`environment: staging` — requires GitHub Environment approvers)
4. `deploy-prod` (`environment: prod` — plan-then-apply on a saved plan file)

Added required secrets list: `TF_STATE_BUCKET`, `TF_STATE_LOCK_TABLE`.

### Documentation

- `infra/terraform/README.md` — init/plan/apply/destroy + bootstrap steps
- `_workspace/06_devops_cost_estimate.md` — monthly USD estimates per env with cost-lever recommendations
- `_workspace/06_devops_ci_cd_flow.md` — Mermaid diagram of the full PR-to-prod pipeline
- Appended to `_workspace/05_devops_runbook.md`:
  - §10 Incident response (triage tree, paging flow, cheat-sheet)
  - §11 Backup & restore (RDS PITR, ElastiCache snapshots, S3 versioning, RPO/RTO)
  - §12 Scaling (horizontal and vertical, when to adjust)
  - §13 Secret rotation (JWT dual-validation, DB password, Redis AUTH)
  - §14 Cost controls (Budgets, Cost Explorer grouping, common fixes)

## File count

- Terraform: **28 files** (root 4 + envs 3 + 9 modules × ~3 files each)
- Workflow: **1 updated** (`.github/workflows/docker-publish.yml`)
- Docs: **2 new** + **1 updated** in `_workspace/`
- This report: **1 file**

Total: ~32 files created/modified.

## Prerequisites (bootstrap) — user must do BEFORE `terraform init`

1. **Create the Terraform state backend** (chicken-and-egg; can't be in these modules):
   - S3 bucket `makit-tfstate-<ACCOUNT_ID>` (versioned, SSE, public access blocked)
   - DynamoDB lock table `makit-tfstate-lock` (PAY_PER_REQUEST, HASH key `LockID`)
   - Exact commands in `infra/terraform/README.md` § Bootstrap.
2. **Request an ACM certificate** in `ap-northeast-2` for your prod domain
   (DNS-validated). Copy ARN into `envs/prod.tfvars` → `acm_certificate_arn`.
3. **Update placeholder values** in every tfvars:
   - `github_org_repo = "YOUR-ORG/makit"`
   - `tfstate_bucket_name = "makit-tfstate-<ACCOUNT_ID>"`
   - `alarm_email_subscribers`
4. **OIDC provider**: only ONE GitHub OIDC provider per account. Apply `dev`
   with `create_github_oidc_provider = true` first; `staging` and `prod`
   tfvars are pre-set to `false`.
5. **GitHub repository secrets** (Settings → Secrets and variables → Actions):
   `AWS_ROLE_ARN`, `ECR_REGISTRY`, `TF_STATE_BUCKET`, `TF_STATE_LOCK_TABLE`.
6. **GitHub Environments** `dev`, `staging`, `prod`: create them and assign
   required reviewers on `staging` (≥1) and `prod` (≥2).
7. **After first RDS apply**: connect and run `CREATE EXTENSION IF NOT EXISTS vector;`
   — pgvector is pre-installed on RDS PG 15 but must be enabled per DB.

## Key assumptions

- AWS account has capacity for 3 VPCs (dev/staging/prod) or is willing to
  peer/share VPCs — current design uses **separate VPCs** per env.
- Region is `ap-northeast-2`. To change, update tfvars and the workflow env.
- ACM cert is provided by the user for prod HTTPS; if absent, ALB serves
  HTTP only (not recommended for prod).
- Route53 / DNS is managed externally — Terraform outputs the ALB DNS name
  only, no records are created.
- Bedrock cost metric `MaKIT/Bedrock/DailyCostUSD` is published by the
  backend (IAM permission is granted; implementation not in scope).
- Single-shard Redis is sufficient; no cluster-mode scaling.
- No WAF (web application firewall) on the ALB — add as a follow-up.
- No CloudFront / CDN — add if latency/egress costs warrant.
- Cross-region DR is out of scope.

## What's left / known follow-ups

- **WAF**: add `aws_wafv2_web_acl` module and associate with the ALB.
- **Route53 alias record**: add a `dns` module once the domain/zone are decided.
- **Read replica**: add to `modules/rds` when traffic shape justifies.
- **VPC endpoints** (S3, Secrets, ECR) to reduce NAT Gateway egress.
- **Fargate Spot** for frontend (capacity providers already permit; set a
  weighted strategy).
- **Bedrock cost metric publisher** in the backend (emit `PutMetricData` to
  `MaKIT/Bedrock/DailyCostUSD`).
- **JWT dual-validation logic** in backend (needed before first rotation per §13).
- **AWS Budgets** — configure in Billing Console; out-of-Terraform.
- **Cross-region backup** — optional; depends on DR policy.

## Constraints observed

- Did NOT run `terraform init/plan/apply` (no credentials; static generation only).
- Did NOT touch `backend/`, `frontend/`, or `.claude/`.
- Terraform pinned `>=1.6`, AWS provider pinned `>=5.50`.
- No hardcoded secrets — all via Secrets Manager ARNs or generated via
  `random_password` on first apply with `ignore_changes`.
- Each module is standalone with its own `main.tf`, `variables.tf`, `outputs.tf`.
- State backend is S3 + DynamoDB; the bucket/table itself is NOT created by
  Terraform (bootstrap is manual, one-time).
