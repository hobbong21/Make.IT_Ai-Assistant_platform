###############################################################################
# ECS Fargate cluster, task definitions (backend + frontend), services behind
# ALB, auto-scaling, and CloudWatch log groups.
###############################################################################

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/makit-backend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/makit-frontend"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name = aws_ecs_cluster.this.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

###############################################################################
# ALB
###############################################################################

resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  idle_timeout               = 60
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "prod"

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb" })
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.name_prefix}-tg-backend"
  port        = 8083
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/actuator/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30
  tags                 = var.tags
}

resource "aws_lb_target_group" "frontend" {
  name        = "${var.name_prefix}-tg-frontend"
  port        = 80
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/healthz"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  deregistration_delay = 30
  tags                 = var.tags
}

# HTTP listener: either redirect to HTTPS (if cert provided) or forward to frontend
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.certificate_arn != "" ? "redirect" : "forward"

    dynamic "redirect" {
      for_each = var.certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    target_group_arn = var.certificate_arn != "" ? null : aws_lb_target_group.frontend.arn
  }
}

# HTTPS listener, only if cert provided
resource "aws_lb_listener" "https" {
  count             = var.certificate_arn != "" ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# Listener rule: /api/* -> backend. Attached to HTTPS if present, else HTTP.
resource "aws_lb_listener_rule" "backend_api" {
  listener_arn = var.certificate_arn != "" ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/actuator/*", "/swagger-ui/*", "/v3/api-docs/*"]
    }
  }
}

###############################################################################
# Task definitions
###############################################################################

locals {
  backend_container = jsonencode([
    {
      name      = "backend"
      image     = "${var.ecr_backend_repo_url}:${var.backend_image_tag}"
      essential = true
      portMappings = [
        { containerPort = 8083, protocol = "tcp" }
      ]
      environment = [
        # PRR-019 fix: include prod-aws overlay profile
        { name = "SPRING_PROFILES_ACTIVE", value = var.environment == "prod" ? "prod,prod-aws" : var.environment },
        { name = "AWS_REGION", value = var.aws_region },
        # PRR-015 fix: RDS requires SSL (rds.force_ssl=1). Append sslmode=require&prepareThreshold=0.
        { name = "SPRING_DATASOURCE_URL", value = "jdbc:postgresql://${var.db_endpoint}/${var.db_name}?sslmode=require&prepareThreshold=0" },
        { name = "SPRING_DATASOURCE_USERNAME", value = var.db_username },
        # Spring Boot 3 property binding targets: spring.data.redis.*
        { name = "SPRING_DATA_REDIS_HOST", value = var.redis_endpoint },
        { name = "SPRING_DATA_REDIS_PORT", value = tostring(var.redis_port) },
        # Keep legacy aliases for any code still reading Boot 2 env names.
        { name = "SPRING_REDIS_HOST", value = var.redis_endpoint },
        { name = "SPRING_REDIS_PORT", value = tostring(var.redis_port) },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = tostring(var.redis_port) },
        { name = "S3_BUCKET", value = var.s3_bucket_name },
        # PRR-017 fix: wire CORS origins from tfvars.
        { name = "CORS_ALLOWED_ORIGINS", value = var.cors_allowed_origins },
        # PRR-018 fix: wire JWT issuer / audience from tfvars.
        { name = "JWT_ISSUER", value = var.jwt_issuer },
        { name = "JWT_AUDIENCE", value = var.jwt_audience }
      ]
      secrets = [
        { name = "JWT_SECRET",      valueFrom = var.jwt_secret_arn },
        { name = "DB_PASSWORD",     valueFrom = var.db_password_secret_arn },
        { name = "SPRING_DATASOURCE_PASSWORD", valueFrom = var.db_password_secret_arn },
        # PRR-014 fix: Spring Boot 3 reads spring.data.redis.password → SPRING_DATA_REDIS_PASSWORD.
        { name = "SPRING_DATA_REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn },
        # Legacy alias for anything still reading Boot 2 or REDIS_PASSWORD env.
        { name = "SPRING_REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn },
        { name = "REDIS_PASSWORD", valueFrom = var.redis_auth_token_secret_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backend"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost:8083/actuator/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  frontend_container = jsonencode([
    {
      name      = "frontend"
      image     = "${var.ecr_frontend_repo_url}:${var.frontend_image_tag}"
      essential = true
      portMappings = [
        { containerPort = 80, protocol = "tcp" }
      ]
      environment = []
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.frontend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "frontend"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://localhost/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.name_prefix}-backend"
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = local.backend_container
  tags                  = var.tags
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.name_prefix}-frontend"
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = var.task_execution_role_arn
  task_role_arn            = var.task_role_arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = local.frontend_container
  tags                  = var.tags
}

###############################################################################
# Services
###############################################################################

resource "aws_ecs_service" "backend" {
  name            = "${var.name_prefix}-backend-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.desired_count_backend
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 90

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.backend_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8083
  }

  lifecycle {
    ignore_changes = [desired_count]  # managed by autoscaling
  }

  depends_on = [aws_lb_listener.http]
  tags       = var.tags
}

resource "aws_ecs_service" "frontend" {
  name            = "${var.name_prefix}-frontend-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.desired_count_frontend
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 30

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.frontend_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 80
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.http]
  tags       = var.tags
}

###############################################################################
# Auto-scaling — target tracking on CPU > 60%
###############################################################################

resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.max_count_backend
  min_capacity       = var.desired_count_backend
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.name_prefix}-backend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "frontend" {
  max_capacity       = var.max_count_frontend
  min_capacity       = var.desired_count_frontend
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_cpu" {
  name               = "${var.name_prefix}-frontend-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
