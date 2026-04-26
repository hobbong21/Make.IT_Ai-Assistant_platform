output "jwt_secret_arn" {
  value = aws_secretsmanager_secret.jwt.arn
}

output "db_password_arn" {
  value = aws_secretsmanager_secret.db.arn
}

output "redis_auth_token_arn" {
  value = aws_secretsmanager_secret.redis_auth.arn
}

# Plaintext value of initial random db password, for passing to RDS module on first apply.
# Marked sensitive; not written to logs.
output "db_password_value" {
  value     = var.generate_values ? random_password.db[0].result : null
  sensitive = true
}

output "redis_auth_token_value" {
  value     = var.generate_values ? random_password.redis_auth[0].result : null
  sensitive = true
}
