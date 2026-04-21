variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "backend_security_group_id" {
  type = string
}

variable "frontend_security_group_id" {
  type = string
}

variable "ecr_backend_repo_url" {
  type = string
}

variable "ecr_frontend_repo_url" {
  type = string
}

variable "backend_image_tag" {
  type    = string
  default = "latest"
}

variable "frontend_image_tag" {
  type    = string
  default = "latest"
}

variable "task_execution_role_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "backend_cpu" {
  type = number
}

variable "backend_memory" {
  type = number
}

variable "frontend_cpu" {
  type = number
}

variable "frontend_memory" {
  type = number
}

variable "desired_count_backend" {
  type = number
}

variable "desired_count_frontend" {
  type = number
}

variable "max_count_backend" {
  type = number
}

variable "max_count_frontend" {
  type = number
}

variable "certificate_arn" {
  description = "ACM cert ARN for HTTPS. Empty string = HTTP-only."
  type        = string
  default     = ""
}

variable "jwt_secret_arn" {
  type = string
}

variable "db_password_secret_arn" {
  type = string
}

variable "redis_auth_token_secret_arn" {
  type = string
}

variable "db_endpoint" {
  type = string
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "redis_endpoint" {
  type = string
}

variable "redis_port" {
  description = "Redis port (from elasticache module output)."
  type        = number
  default     = 6379
}

variable "cors_allowed_origins" {
  description = "Comma-separated origins for CORS allow-list."
  type        = string
  default     = "https://your-domain.com"
}

variable "jwt_issuer" {
  description = "JWT `iss` claim value."
  type        = string
  default     = "https://makit.example.com"
}

variable "jwt_audience" {
  description = "JWT `aud` claim value."
  type        = string
  default     = "makit-web"
}

variable "s3_bucket_name" {
  type = string
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "tags" {
  type    = map(string)
  default = {}
}
