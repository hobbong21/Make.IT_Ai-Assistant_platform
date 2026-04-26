variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "alarm_email_subscribers" {
  description = "Email addresses subscribed to the SNS topic."
  type        = list(string)
  default     = []
}

variable "backend_log_group_name" {
  type = string
}

variable "frontend_log_group_name" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "backend_service_name" {
  type = string
}

variable "frontend_service_name" {
  type = string
}

variable "backend_target_group_arn_suffix" {
  type = string
}

variable "alb_arn_suffix" {
  type = string
}

variable "rds_instance_id" {
  type = string
}

variable "redis_cluster_id" {
  description = "Replication group id (prod) or standalone cluster id. Used for dashboard widgets where CacheClusterId-dim isn't required."
  type        = string
}

# PRR-026 fix: per-node alarms. Each entry is a CacheClusterId that CloudWatch
# publishes AWS/ElastiCache metrics under.
variable "redis_node_ids" {
  description = "Set of CacheClusterId values to alarm on (from elasticache module's node_ids output)."
  type        = set(string)
  default     = []
}

# PRR-043: removed bedrock_daily_cost_usd_threshold — see §14 runbook.
# Kept as variable for backward compat with tfvars but no longer consumed.
variable "bedrock_daily_cost_usd_threshold" {
  description = "DEPRECATED (PRR-043). The app-side DailyCostUSD publisher is v1.2 backlog; cost is tracked via AWS Cost Explorer + Budgets."
  type        = number
  default     = 100
}

variable "tags" {
  type    = map(string)
  default = {}
}
