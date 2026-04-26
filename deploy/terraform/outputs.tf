###############################################################################
# MaKIT — Root outputs
###############################################################################

output "alb_dns_name" {
  description = "Public ALB DNS name."
  value       = module.ecs.alb_dns_name
}

output "alb_zone_id" {
  description = "ALB hosted zone ID (for Route53 alias records)."
  value       = module.ecs.alb_zone_id
}

output "rds_endpoint" {
  description = "RDS writer endpoint."
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint."
  value       = module.elasticache.primary_endpoint
  sensitive   = true
}

output "ecr_backend_repo_url" {
  description = "ECR URL for makit-backend."
  value       = module.ecr.repository_urls["makit-backend"]
}

output "ecr_frontend_repo_url" {
  description = "ECR URL for makit-frontend."
  value       = module.ecr.repository_urls["makit-frontend"]
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.cluster_name
}

output "ecs_backend_service_arn" {
  description = "ECS backend service ARN."
  value       = module.ecs.backend_service_arn
}

output "ecs_frontend_service_arn" {
  description = "ECS frontend service ARN."
  value       = module.ecs.frontend_service_arn
}

output "s3_assets_bucket" {
  description = "S3 bucket for static assets."
  value       = module.s3_assets.bucket_name
}

output "github_oidc_role_arn" {
  description = "Role ARN for GitHub Actions to assume."
  value       = module.iam.github_oidc_role_arn
}

output "sns_alerts_topic_arn" {
  description = "SNS topic for alarms."
  value       = module.monitoring.alerts_topic_arn
}
