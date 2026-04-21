output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "backend_service_arn" {
  value = aws_ecs_service.backend.id
}

output "frontend_service_arn" {
  value = aws_ecs_service.frontend.id
}

output "backend_service_name" {
  value = aws_ecs_service.backend.name
}

output "frontend_service_name" {
  value = aws_ecs_service.frontend.name
}

output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_arn_suffix" {
  value = aws_lb.this.arn_suffix
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_zone_id" {
  value = aws_lb.this.zone_id
}

output "backend_target_group_arn" {
  value = aws_lb_target_group.backend.arn
}

output "backend_target_group_arn_suffix" {
  value = aws_lb_target_group.backend.arn_suffix
}

output "frontend_target_group_arn" {
  value = aws_lb_target_group.frontend.arn
}

output "backend_log_group_name" {
  value = aws_cloudwatch_log_group.backend.name
}

output "frontend_log_group_name" {
  value = aws_cloudwatch_log_group.frontend.name
}
