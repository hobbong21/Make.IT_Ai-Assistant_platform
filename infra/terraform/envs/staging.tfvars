environment = "staging"
aws_region  = "ap-northeast-2"
owner       = "makit-staging"

# Network
vpc_cidr             = "10.30.0.0/16"
availability_zones   = ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
public_subnet_cidrs  = ["10.30.0.0/24", "10.30.1.0/24", "10.30.2.0/24"]
private_subnet_cidrs = ["10.30.10.0/24", "10.30.11.0/24", "10.30.12.0/24"]

# RDS
rds_instance_class           = "db.t4g.large"
rds_allocated_storage_gb     = 100
rds_max_allocated_storage_gb = 500

db_name     = "makit"
db_username = "makit_admin"

# Redis
redis_node_type = "cache.t4g.medium"

# ECS
ecs_backend_cpu            = 1024
ecs_backend_memory         = 2048
ecs_frontend_cpu           = 256
ecs_frontend_memory        = 512
ecs_desired_count_backend  = 2
ecs_desired_count_frontend = 2
ecs_max_count_backend      = 4
ecs_max_count_frontend     = 4

backend_image_tag  = "latest"
frontend_image_tag = "latest"

acm_certificate_arn = ""

github_org_repo             = "YOUR-ORG/makit"
github_deploy_branch        = "main"
create_github_oidc_provider = false

tfstate_bucket_name = "makit-tfstate-REPLACE-ACCOUNT"
tfstate_lock_table  = "makit-tfstate-lock"

alarm_email_subscribers          = ["devops@example.com"]
bedrock_daily_cost_usd_threshold = 50

# PRR-017/018: app config wired into ECS task-def env.
cors_allowed_origins = "https://makit-staging.example.com"
jwt_issuer           = "https://makit.staging.example.com"
jwt_audience         = "makit-web"
