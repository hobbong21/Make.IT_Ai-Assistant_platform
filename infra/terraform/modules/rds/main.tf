###############################################################################
# RDS PostgreSQL 15 + pgvector.
#
# NOTE on pgvector: AWS RDS PostgreSQL 15 ships with the pgvector extension
# available (no need to add to shared_preload_libraries). After first apply,
# run `CREATE EXTENSION IF NOT EXISTS vector;` in the app schema. pg_stat_statements
# is enabled via shared_preload_libraries in the custom parameter group.
###############################################################################

# Resolve the secret value so RDS gets the password on first creation.
# After first apply, rotate in-place; this data source always reads the
# CURRENT value at plan time.
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = var.db_password_secret_arn
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-rds-subnets"
  subnet_ids = var.subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-rds-subnets" })
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds-sg"
  description = "RDS PostgreSQL — ingress from backend ECS only"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_security_group_ids
    content {
      description     = "Postgres 5432 from allowed SG"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-rds-sg" })
}

resource "aws_db_parameter_group" "this" {
  name        = "${var.name_prefix}-pg15-pgvector"
  family      = "postgres15"
  description = "MaKIT — pg_stat_statements + pgvector (loaded via CREATE EXTENSION)"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # slow query log >1s
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
    apply_method = "pending-reboot"
  }

  tags = var.tags
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  db_name  = var.db_name
  username = var.db_username
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
  port     = 5432

  allocated_storage     = var.allocated_storage_gb
  max_allocated_storage = var.max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name

  multi_az                    = var.multi_az
  backup_retention_period     = var.backup_retention_days
  backup_window               = "17:00-18:00" # UTC (≈02-03 KST)
  maintenance_window          = "sun:18:30-sun:19:30"
  auto_minor_version_upgrade  = true
  apply_immediately           = var.environment != "prod"
  copy_tags_to_snapshot       = true

  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? 7 : null
  monitoring_interval                   = var.performance_insights_enabled ? 60 : 0

  deletion_protection = var.environment == "prod"
  skip_final_snapshot = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.name_prefix}-postgres-final"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  lifecycle {
    ignore_changes = [password]  # rotate via Secrets Manager, not Terraform
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}
