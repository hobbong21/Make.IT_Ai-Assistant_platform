output "ecs_task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "ecs_task_role_arn" {
  value = aws_iam_role.task.arn
}

output "github_oidc_role_arn" {
  value = aws_iam_role.github_oidc.arn
}
