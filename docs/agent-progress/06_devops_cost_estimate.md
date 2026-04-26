# MaKIT — Monthly AWS Cost Estimate

**Author**: devops-engineer
**Date**: 2026-04-20
**Region**: `ap-northeast-2` (Seoul)
**Status**: Non-binding estimate. Rough 2026 on-demand pricing — always verify against the AWS Pricing Calculator and actual Cost Explorer data before committing to budgets.

All figures are USD/month, rounded. No savings plans / reserved instances assumed (those can cut 30-55% on compute).

---

## Dev environment

| Service             | Shape                                         | Est. USD/mo |
|---------------------|-----------------------------------------------|-------------|
| RDS PostgreSQL      | `db.t4g.medium` single-AZ, 100 GB gp3         | 90          |
| ElastiCache Redis   | `cache.t4g.small` single node                 | 25          |
| ECS Fargate         | backend 1x(1 vCPU/2GB) + frontend 1x(0.25/0.5), 24/7 | 55   |
| NAT Gateway         | 1 x NAT + ~50 GB egress                       | 45          |
| ALB                 | 1 ALB, low traffic                            | 22          |
| S3                  | 20 GB + 100k requests                         | 2           |
| CloudWatch          | Logs 10 GB + 15 alarms + 1 dashboard          | 10          |
| Secrets Manager     | 3 secrets                                     | 2           |
| Bedrock             | light dev usage, ~$25 cap                     | 25          |
| ECR                 | 2 repos, ~5 GB                                | 1           |
| Data transfer       | ~20 GB egress                                 | 2           |
| **Subtotal (dev)**  |                                               | **~279**    |

## Staging environment

| Service             | Shape                                         | Est. USD/mo |
|---------------------|-----------------------------------------------|-------------|
| RDS PostgreSQL      | `db.t4g.large` single-AZ, 100 GB gp3          | 160         |
| ElastiCache Redis   | `cache.t4g.medium` single node                | 50          |
| ECS Fargate         | 2+2 tasks, same sizing as dev                 | 110         |
| NAT Gateway         | 1 x NAT + ~100 GB egress                      | 55          |
| ALB                 | 1 ALB, moderate traffic                       | 25          |
| S3                  | 50 GB + 500k requests                         | 4           |
| CloudWatch          | Logs 30 GB + 15 alarms + 1 dashboard          | 20          |
| Secrets Manager     | 3 secrets                                     | 2           |
| Bedrock             | ~$50 cap                                      | 50          |
| ECR                 | ~5 GB                                         | 1           |
| Data transfer       | ~60 GB egress                                 | 5           |
| **Subtotal (staging)** |                                            | **~482**    |

## Prod environment

| Service             | Shape                                          | Est. USD/mo |
|---------------------|------------------------------------------------|-------------|
| RDS PostgreSQL      | `db.m6g.large` **multi-AZ**, 200 GB gp3, PI    | 440         |
| ElastiCache Redis   | `cache.m6g.large` replication group (2 nodes)  | 290         |
| ECS Fargate         | backend 2x(2 vCPU/4GB) + frontend 2x(0.5/1), 24/7 | 255      |
| NAT Gateway         | 3 x NAT (one per AZ) + ~500 GB egress          | 140         |
| ALB                 | 1 ALB, production traffic                      | 40          |
| S3                  | 200 GB + 5M requests + IA transitions          | 15          |
| CloudWatch          | Logs 100 GB (90d) + 15 alarms + dashboard      | 60          |
| Secrets Manager     | 3 secrets                                      | 2           |
| Bedrock             | production traffic — highly variable           | 300 – 1500  |
| ECR                 | ~10 GB                                         | 2           |
| Data transfer       | ~500 GB egress                                 | 45          |
| **Subtotal (prod)** |                                                | **~1589 – 2789** |

## Totals (rough)

| Env     | Monthly USD        |
|---------|--------------------|
| Dev     | ~280               |
| Staging | ~480               |
| Prod    | ~1,600 – 2,800     |
| **All** | **~2,360 – 3,560** |

---

## Big levers if cost is a concern

1. **Bedrock** is by far the most volatile — put a daily cap via the
   `bedrock_daily_cost_usd_threshold` alarm and enforce quotas at the
   application layer.
2. **Multi-AZ RDS** doubles RDS cost. Consider single-AZ with fast
   point-in-time recovery for cost-sensitive staging.
3. **NAT Gateway** in prod is ~$100/mo on its own; if egress traffic is
   low, consider `single_nat_gateway = true` and accept the AZ failure
   blast radius, or move to VPC endpoints for AWS services.
4. **Fargate Spot** for frontend tasks saves ~70% but can be interrupted;
   enable via `FARGATE_SPOT` in the cluster capacity providers (already set).
5. **Savings Plans**: 1-year compute savings plan typically saves 30-45%
   on Fargate + on-demand RDS. Reconsider once prod usage stabilizes.

## Caveats

- Bedrock token pricing varies heavily by model — Sonnet ~15x more expensive
  per input token than Haiku. Right-model selection dominates cost.
- Data transfer: if users are globally distributed and CloudFront is added
  later, egress cost can shift substantially.
- Image pulls are free only inside the same region — cross-region replication
  would add cost.
- Prices assumed on-demand as of 2026-04. AWS price changes over time.

**Not binding. Reconcile monthly against Cost Explorer.**
