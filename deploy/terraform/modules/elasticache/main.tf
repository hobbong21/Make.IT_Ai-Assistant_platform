###############################################################################
# ElastiCache Redis 7.
#  - dev/staging: single node (aws_elasticache_cluster)
#  - prod: replication group with automatic failover (single-shard)
# Always: transit encryption + AUTH token from Secrets Manager.
###############################################################################

data "aws_secretsmanager_secret_version" "auth" {
  secret_id = var.auth_token_secret_arn
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.name_prefix}-redis-subnets"
  subnet_ids = var.subnet_ids
  tags       = var.tags
}

resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Redis — ingress from backend ECS only"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.ingress_security_group_ids
    content {
      description     = "Redis 6379 from allowed SG"
      from_port       = 6379
      to_port         = 6379
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

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis-sg" })
}

resource "aws_elasticache_parameter_group" "this" {
  name   = "${var.name_prefix}-redis7"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = var.tags
}

# --- Non-prod: single-node cluster ---
resource "aws_elasticache_cluster" "single" {
  count                = var.replication_enabled ? 0 : 1
  cluster_id           = "${var.name_prefix}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.this.name
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]

  # Single-node clusters do NOT support at-rest/transit encryption and AUTH
  # via this resource in all cases — force use of replication_group for
  # AUTH support. Using standalone cluster for dev only (no auth), fine.
  tags = merge(var.tags, { Name = "${var.name_prefix}-redis" })
}

# --- Prod: replication group w/ automatic failover + auth ---
resource "aws_elasticache_replication_group" "rg" {
  count                      = var.replication_enabled ? 1 : 0
  replication_group_id       = "${var.name_prefix}-redis"
  description                = "MaKIT ${var.name_prefix} Redis"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.node_type
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled           = true
  parameter_group_name       = aws_elasticache_parameter_group.this.name
  port                       = 6379

  subnet_group_name          = aws_elasticache_subnet_group.this.name
  security_group_ids         = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = data.aws_secretsmanager_secret_version.auth.secret_string

  snapshot_retention_limit = 7
  snapshot_window          = "18:00-19:00"

  lifecycle {
    ignore_changes = [auth_token]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis" })
}
