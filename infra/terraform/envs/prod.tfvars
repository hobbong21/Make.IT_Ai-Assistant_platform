environment = "prod"
aws_region  = "ap-northeast-2"
owner       = "makit-prod"

# Network
vpc_cidr             = "10.40.0.0/16"
availability_zones   = ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
public_subnet_cidrs  = ["10.40.0.0/24", "10.40.1.0/24", "10.40.2.0/24"]
private_subnet_cidrs = ["10.40.10.0/24", "10.40.11.0/24", "10.40.12.0/24"]

# RDS (prod = multi-AZ, larger)
rds_instance_class           = "db.m6g.large"
rds_allocated_storage_gb     = 200
rds_max_allocated_storage_gb = 1000

db_name     = "makit"
db_username = "makit_admin"

# Redis (prod = replication group)
redis_node_type = "cache.m6g.large"

# ECS (prod = 2 vCPU / 4 GB, higher scale)
ecs_backend_cpu            = 2048
ecs_backend_memory         = 4096
ecs_frontend_cpu           = 512
ecs_frontend_memory        = 1024
ecs_desired_count_backend  = 2
ecs_desired_count_frontend = 2
ecs_max_count_backend      = 6
ecs_max_count_frontend     = 6

backend_image_tag  = "latest"
frontend_image_tag = "latest"

# Provide ACM cert ARN for HTTPS
acm_certificate_arn = "arn:aws:acm:ap-northeast-2:REPLACE-ACCOUNT:certificate/REPLACE-CERT-ID"

github_org_repo             = "YOUR-ORG/makit"
github_deploy_branch        = "main"
create_github_oidc_provider = false

tfstate_bucket_name = "makit-tfstate-REPLACE-ACCOUNT"
tfstate_lock_table  = "makit-tfstate-lock"

alarm_email_subscribers          = ["oncall@example.com", "devops@example.com"]
# PRR-043: app-side DailyCostUSD alarm removed for v1 (no publisher). Kept for
# backward compat; has no effect until a Micrometer→CloudWatch bridge ships.
bedrock_daily_cost_usd_threshold = 100

# PRR-017/018: app config wired into ECS task-def env.
# Replace with the real prod domain once known (must be HTTPS).
cors_allowed_origins = "https://makit.example.com"
jwt_issuer           = "https://makit.prod.example.com"
jwt_audience         = "makit-web"
