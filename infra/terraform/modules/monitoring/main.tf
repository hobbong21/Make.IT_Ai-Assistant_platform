###############################################################################
# Monitoring: SNS topic, CloudWatch alarms, dashboard.
#
# The log groups themselves are created by the ECS module; this module only
# wires alarms around them plus service/infra metrics.
###############################################################################

resource "aws_sns_topic" "alerts" {
  name = "${var.name_prefix}-alerts"
  tags = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  for_each  = toset(var.alarm_email_subscribers)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

locals {
  alarm_prefix = "${var.name_prefix}"
}

###############################################################################
# ALB / backend alarms
###############################################################################

resource "aws_cloudwatch_metric_alarm" "backend_5xx_rate" {
  alarm_name          = "${local.alarm_prefix}-backend-5xx-rate"
  alarm_description   = "Backend HTTP 5xx rate exceeds 1% over 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0.01
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "e1"
    expression  = "IF(m_total > 0, m_5xx / m_total, 0)"
    label       = "5xx rate"
    return_data = true
  }

  metric_query {
    id = "m_5xx"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = var.backend_target_group_arn_suffix
      }
    }
  }

  metric_query {
    id = "m_total"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 300
      stat        = "Sum"
      dimensions = {
        LoadBalancer = var.alb_arn_suffix
        TargetGroup  = var.backend_target_group_arn_suffix
      }
    }
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "backend_p95_latency" {
  alarm_name          = "${local.alarm_prefix}-backend-p95-latency"
  alarm_description   = "Backend p95 latency > 2s over 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.backend_target_group_arn_suffix
  }

  tags = var.tags
}

###############################################################################
# RDS alarms
###############################################################################

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.alarm_prefix}-rds-cpu-high"
  alarm_description   = "RDS CPU > 80% sustained 10 min"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 80
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions = { DBInstanceIdentifier = var.rds_instance_id }
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${local.alarm_prefix}-rds-storage-low"
  alarm_description   = "RDS FreeStorageSpace < 10 GB"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  threshold           = 10737418240 # 10 GiB in bytes
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions = { DBInstanceIdentifier = var.rds_instance_id }
  tags                = var.tags
}

###############################################################################
# ElastiCache alarms
###############################################################################

# PRR-026 fix: CloudWatch ElastiCache metrics are published per CacheClusterId
# (the node id, e.g. makit-prod-redis-001), NOT per replication_group_id.
# Create one alarm per node via for_each over the module's node_ids output.
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  for_each            = var.redis_node_ids
  alarm_name          = "${local.alarm_prefix}-redis-cpu-high-${each.value}"
  alarm_description   = "Redis CPU > 75% sustained 10 min on node ${each.value}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 75
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  dimensions          = { CacheClusterId = each.value }
  tags                = var.tags
}

###############################################################################
# ECS service health
###############################################################################

resource "aws_cloudwatch_metric_alarm" "backend_desired_vs_running" {
  alarm_name          = "${local.alarm_prefix}-backend-count-mismatch"
  alarm_description   = "Backend ECS running tasks < desired for 10 min (scaling issue)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  metric_query {
    id          = "e1"
    expression  = "desired - running"
    label       = "Desired minus Running"
    return_data = true
  }

  metric_query {
    id = "desired"
    metric {
      metric_name = "DesiredTaskCount"
      namespace   = "ECS/ContainerInsights"
      period      = 300
      stat        = "Maximum"
      dimensions = {
        ClusterName = var.ecs_cluster_name
        ServiceName = var.backend_service_name
      }
    }
  }

  metric_query {
    id = "running"
    metric {
      metric_name = "RunningTaskCount"
      namespace   = "ECS/ContainerInsights"
      period      = 300
      stat        = "Minimum"
      dimensions = {
        ClusterName = var.ecs_cluster_name
        ServiceName = var.backend_service_name
      }
    }
  }

  tags = var.tags
}

###############################################################################
# Bedrock cost (custom metric published by backend)
#
# PRR-043 fix: the MaKIT/Bedrock/DailyCostUSD alarm was a dead path — the
# backend has no Micrometer → CloudWatch bridge, so the metric was never
# published. The alarm silently sat in INSUFFICIENT_DATA and was masked by
# treat_missing_data=notBreaching. For v1 prod we use AWS Cost Explorer and
# AWS Budgets for cost visibility (see runbook §14). Re-add this alarm when
# the backend adds `micrometer-registry-cloudwatch2` and publishes in the
# `MaKIT/Bedrock` namespace (v1.2 backlog).
###############################################################################

###############################################################################
# Dashboard
###############################################################################

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name_prefix}-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title  = "ALB — Request rate"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", period = 60 }]
          ]
          view = "timeSeries"
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6,
        properties = {
          title  = "Backend latency p50/p95/p99"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.backend_target_group_arn_suffix, { stat = "p50", label = "p50" }],
            ["...", { stat = "p95", label = "p95" }],
            ["...", { stat = "p99", label = "p99" }]
          ]
          view = "timeSeries"
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title  = "HTTP status breakdown"
          region = var.aws_region
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.backend_target_group_arn_suffix, { stat = "Sum", label = "2xx" }],
            [".", "HTTPCode_Target_4XX_Count", ".", ".", ".", ".", { stat = "Sum", label = "4xx" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", ".", ".", { stat = "Sum", label = "5xx" }]
          ]
          view = "timeSeries", stacked = true
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title  = "RDS CPU & IOPS"
          region = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", var.rds_instance_id, { label = "CPU %" }],
            [".", "ReadIOPS", ".", ".", { label = "Read IOPS", yAxis = "right" }],
            [".", "WriteIOPS", ".", ".", { label = "Write IOPS", yAxis = "right" }]
          ]
          view = "timeSeries"
        }
      },
      {
        type = "metric", x = 0, y = 12, width = 24, height = 6,
        properties = {
          title  = "Redis memory & CPU"
          region = var.aws_region
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "CacheClusterId", var.redis_cluster_id],
            [".", "DatabaseMemoryUsagePercentage", ".", "."]
          ]
          view = "timeSeries"
        }
      }
      # PRR-043 / PRR-058: Bedrock tokens & cost widget removed. The
      # MaKIT/Bedrock namespace has no publisher yet (no Micrometer → CloudWatch
      # bridge in the backend). Use AWS Cost Explorer + Bedrock service usage
      # reports for cost visibility. See runbook §14.
    ]
  })
}
