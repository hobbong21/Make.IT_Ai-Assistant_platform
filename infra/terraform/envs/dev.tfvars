environment = "dev"
aws_region  = "ap-northeast-2"
owner       = "makit-dev"

# Network
vpc_cidr             = "10.20.0.0/16"
availability_zones   = ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
public_subnet_cidrs  = ["10.20.0.0/24", "10.20.1.0/24", "10.20.2.0/24"]
private_subnet_cidrs = ["10.20.10.0/24", "10.20.11.0/24", "10.20.12.0/24"]

# RDS (dev = single AZ, smaller)
rds_instance_class           = "db.t4g.medium"
rds_allocated_storage_gb     = 100
rds_max_allocated_storage_gb = 500

db_name     = "makit"
db_username = "makit_admin"

# Redis
redis_node_type = "cache.t4g.small"

# ECS
ecs_backend_cpu            = 1024
ecs_backend_memory         = 2048
ecs_frontend_cpu           = 256
ecs_frontend_memory        = 512
ecs_desired_count_backend  = 1
ecs_desired_count_frontend = 1
ecs_max_count_backend      = 3
ecs_max_count_frontend     = 3

backend_image_tag  = "latest"
frontend_image_tag = "latest"

# ACM cert — dev usually has none; HTTP only
acm_certificate_arn = ""

# GitHub OIDC
github_org_repo             = "YOUR-ORG/makit"
github_deploy_branch        = "main"
# Set false in staging/prod since only ONE OIDC provider per account is allowed.
create_github_oidc_provider = true

# TF state backend
tfstate_bucket_name = "makit-tfstate-REPLACE-ACCOUNT"
tfstate_lock_table  = "makit-tfstate-lock"

# Monitoring
alarm_email_subscribers          = ["devops@example.com"]
bedrock_daily_cost_usd_threshold = 25

# PRR-017/018: app config wired into ECS task-def env.
cors_allowed_origins = "http://localhost,http://localhost:8080,http://localhost:8083"
jwt_issuer           = "https://makit.dev.example.com"
jwt_audience         = "makit-web"
