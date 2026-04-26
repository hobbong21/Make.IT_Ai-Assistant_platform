# MaKIT — Terraform Infrastructure

Infrastructure-as-code for the MaKIT AI Assistant platform on AWS.
Target regions: `ap-northeast-2` (Seoul).
Terraform `>=1.6`, AWS provider `>=5.50`.

## Layout

```
deploy/terraform/
  main.tf            # Module wiring
  variables.tf       # Root inputs
  outputs.tf         # Root outputs (ALB, endpoints, ARNs)
  versions.tf        # Provider pinning
  envs/
    dev.tfvars
    staging.tfvars
    prod.tfvars
  modules/
    network/         # VPC, subnets, NAT, SGs
    ecr/             # Container registries
    secrets/         # Secrets Manager entries
    iam/             # Task Exec / Task / GitHub OIDC roles
    s3/              # makit-assets bucket
    rds/             # PostgreSQL 15 + pgvector
    elasticache/     # Redis 7
    ecs/             # Cluster, tasks, services, ALB, autoscaling
    monitoring/      # CloudWatch alarms + dashboard + SNS
```

---

## Bootstrap (one-time per AWS account)

Before the first `terraform init`, a human operator must create the Terraform
state backend. This is deliberately NOT managed by these modules (chicken-and-egg).

```bash
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGION=ap-northeast-2
export TF_BUCKET=makit-tfstate-${ACCOUNT_ID}

# 1. State bucket (versioned + encrypted + block public)
aws s3api create-bucket \
  --bucket $TF_BUCKET \
  --region $REGION \
  --create-bucket-configuration LocationConstraint=$REGION

aws s3api put-bucket-versioning \
  --bucket $TF_BUCKET \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket $TF_BUCKET \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket $TF_BUCKET \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. Lock table
aws dynamodb create-table \
  --table-name makit-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION
```

Then set `tfstate_bucket_name = "makit-tfstate-<ACCOUNT_ID>"` in each tfvars.

### Before applying prod

1. Request an ACM certificate in the target region (DNS validation).
   Put the ARN in `envs/prod.tfvars` → `acm_certificate_arn`.
2. Decide whether the GitHub OIDC provider already exists in the account.
   Only **one** per account. Set `create_github_oidc_provider = false`
   in all envs beyond the first one to apply.
3. Replace `github_org_repo = "YOUR-ORG/makit"` in all three tfvars.
4. Replace `alarm_email_subscribers` with real addresses.

---

## Workflow

### Initialize per environment

Each environment has its own state file (key). Pass backend config at init.

```bash
cd deploy/terraform

terraform init \
  -backend-config="bucket=makit-tfstate-${ACCOUNT_ID}" \
  -backend-config="key=makit/dev/terraform.tfstate" \
  -backend-config="region=ap-northeast-2" \
  -backend-config="dynamodb_table=makit-tfstate-lock" \
  -backend-config="encrypt=true" \
  -reconfigure
```

### Plan / apply

```bash
terraform plan  -var-file=envs/dev.tfvars -out=dev.plan
terraform apply dev.plan
```

For CI deploys (image tag override):
```bash
terraform apply \
  -var-file=envs/dev.tfvars \
  -var="backend_image_tag=${GITHUB_SHA}" \
  -var="frontend_image_tag=${GITHUB_SHA}" \
  -auto-approve
```

### Destroy (dev only — prod has deletion protection)

```bash
terraform destroy -var-file=envs/dev.tfvars
```

---

## Secret rotation

Secrets are created with random initial values by the `secrets` module.
To rotate, update the value directly in AWS Secrets Manager (console or CLI);
Terraform ignores `secret_string` changes (`lifecycle { ignore_changes }`).

See `_workspace/05_devops_runbook.md` §13.

---

## Known limitations / follow-ups

- No WAF in front of the ALB (add later per-env).
- No Route53 zone / DNS record — assumes an external DNS.
- No cross-region backups.
- RDS pgvector: extension is available on RDS PG 15 by default; run
  `CREATE EXTENSION IF NOT EXISTS vector;` manually after first apply.
- Bedrock cost metric (`MaKIT/Bedrock/DailyCostUSD`) must be published by
  the backend — alarm treats missing data as "not breaching" so it won't
  fire if the metric never appears.
