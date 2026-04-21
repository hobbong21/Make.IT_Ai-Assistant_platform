###############################################################################
# Secrets Manager entries.
# Secret names follow the pattern `makit/<env>/<key>` so IAM policies
# (arn:aws:secretsmanager:*:*:secret:makit/*) cover them.
#
# If generate_values = true, Terraform creates a random initial value.
# Rotate out-of-band afterwards — Terraform will NOT manage the value
# (ignore_changes on secret version value).
###############################################################################

resource "random_password" "jwt" {
  count            = var.generate_values ? 1 : 0
  length           = 64
  special          = true
  override_special = "!@#$%^&*()-_=+"
}

resource "random_password" "db" {
  count   = var.generate_values ? 1 : 0
  length  = 40
  special = false  # RDS disallows some chars; stay alphanumeric
}

resource "random_password" "redis_auth" {
  count   = var.generate_values ? 1 : 0
  length  = 48
  special = false  # ElastiCache AUTH token: 16-128 printable chars, no spaces
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "makit/${var.environment}/jwt-secret"
  description             = "JWT signing secret for MaKIT ${var.environment}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 7
  tags                    = merge(var.tags, { SecretType = "jwt" })
}

resource "aws_secretsmanager_secret" "db" {
  name                    = "makit/${var.environment}/db-password"
  description             = "RDS master password for MaKIT ${var.environment}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 7
  tags                    = merge(var.tags, { SecretType = "db-password" })
}

resource "aws_secretsmanager_secret" "redis_auth" {
  name                    = "makit/${var.environment}/redis-auth-token"
  description             = "ElastiCache AUTH token for MaKIT ${var.environment}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 7
  tags                    = merge(var.tags, { SecretType = "redis-auth" })
}

resource "aws_secretsmanager_secret_version" "jwt" {
  count         = var.generate_values ? 1 : 0
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt[0].result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  count         = var.generate_values ? 1 : 0
  secret_id     = aws_secretsmanager_secret.db.id
  secret_string = random_password.db[0].result

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  count         = var.generate_values ? 1 : 0
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = random_password.redis_auth[0].result

  lifecycle {
    ignore_changes = [secret_string]
  }
}
