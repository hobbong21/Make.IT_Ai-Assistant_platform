###############################################################################
# MaKIT — Root variables
###############################################################################

variable "environment" {
  description = "Deployment environment (dev | staging | prod)."
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "ap-northeast-2"
}

variable "owner" {
  description = "Owner tag applied to all resources."
  type        = string
  default     = "makit-team"
}

# ---- Network -----------------------------------------------------------------

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to spread subnets across (3 recommended)."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs (ALB)."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs (ECS, RDS, Redis)."
  type        = list(string)
}

# ---- RDS ---------------------------------------------------------------------

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "rds_allocated_storage_gb" {
  description = "Initial RDS storage (GB)."
  type        = number
  default     = 100
}

variable "rds_max_allocated_storage_gb" {
  description = "Storage autoscaling upper bound (GB)."
  type        = number
  default     = 500
}

variable "db_name" {
  description = "Initial database name."
  type        = string
  default     = "makit"
}

variable "db_username" {
  description = "Master DB username."
  type        = string
  default     = "makit_admin"
}

# ---- ElastiCache -------------------------------------------------------------

variable "redis_node_type" {
  description = "Redis node type."
  type        = string
  default     = "cache.t4g.small"
}

# ---- ECS ---------------------------------------------------------------------

variable "backend_image_tag" {
  description = "Image tag for makit-backend (e.g. git SHA)."
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Image tag for makit-frontend (e.g. git SHA)."
  type        = string
  default     = "latest"
}

variable "ecs_backend_cpu" {
  description = "Backend task CPU units (1024 = 1 vCPU)."
  type        = number
  default     = 1024
}

variable "ecs_backend_memory" {
  description = "Backend task memory (MiB)."
  type        = number
  default     = 2048
}

variable "ecs_frontend_cpu" {
  description = "Frontend task CPU units."
  type        = number
  default     = 256
}

variable "ecs_frontend_memory" {
  description = "Frontend task memory (MiB)."
  type        = number
  default     = 512
}

variable "ecs_desired_count_backend" {
  description = "Backend desired task count."
  type        = number
  default     = 1
}

variable "ecs_desired_count_frontend" {
  description = "Frontend desired task count."
  type        = number
  default     = 1
}

variable "ecs_max_count_backend" {
  description = "Backend auto-scaling maximum."
  type        = number
  default     = 3
}

variable "ecs_max_count_frontend" {
  description = "Frontend auto-scaling maximum."
  type        = number
  default     = 3
}

variable "acm_certificate_arn" {
  description = "ACM cert ARN for ALB HTTPS. Leave empty to serve plain HTTP only."
  type        = string
  default     = ""
}

# ---- Secrets -----------------------------------------------------------------

variable "generate_secret_values" {
  description = "When true, Terraform creates random values for secrets on first apply. Set false to populate out-of-band."
  type        = bool
  default     = true
}

# ---- GitHub OIDC -------------------------------------------------------------

variable "github_org_repo" {
  description = "GitHub org/repo for OIDC trust (e.g. my-org/makit)."
  type        = string
}

variable "github_deploy_branch" {
  description = "Branch allowed to assume the deploy role."
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if already exists in the account (only one per account is allowed)."
  type        = bool
  default     = true
}

# ---- Terraform state backend (for IAM permissions only — bucket is bootstrapped manually) ----

variable "tfstate_bucket_name" {
  description = "Terraform state S3 bucket name (for OIDC role permissions)."
  type        = string
}

variable "tfstate_lock_table" {
  description = "DynamoDB lock table name (for OIDC role permissions)."
  type        = string
  default     = "makit-tfstate-lock"
}

# ---- Monitoring --------------------------------------------------------------

variable "alarm_email_subscribers" {
  description = "Email addresses subscribed to the alerts SNS topic."
  type        = list(string)
  default     = []
}

variable "bedrock_daily_cost_usd_threshold" {
  description = "Alarm fires if Bedrock cost custom metric exceeds this USD/day."
  type        = number
  default     = 100
}

# ---- App config (wired into ECS task-def env) --------------------------------

variable "cors_allowed_origins" {
  description = "Comma-separated list of origins allowed by the backend CORS filter. Wired to CORS_ALLOWED_ORIGINS env var."
  type        = string
  default     = "https://your-domain.com"
}

variable "jwt_issuer" {
  description = "JWT issuer (`iss`) claim value. Wired to JWT_ISSUER env var."
  type        = string
  default     = "https://makit.example.com"
}

variable "jwt_audience" {
  description = "JWT audience (`aud`) claim value. Wired to JWT_AUDIENCE env var."
  type        = string
  default     = "makit-web"
}
