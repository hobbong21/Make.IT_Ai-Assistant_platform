output "primary_endpoint" {
  value = var.replication_enabled ? aws_elasticache_replication_group.rg[0].primary_endpoint_address : aws_elasticache_cluster.single[0].cache_nodes[0].address
}

output "port" {
  value = 6379
}

output "cluster_id" {
  value = var.replication_enabled ? aws_elasticache_replication_group.rg[0].id : aws_elasticache_cluster.single[0].id
}

# PRR-026 support: CloudWatch metrics for ElastiCache publish per CacheClusterId
# (e.g. `makit-prod-redis-001`, `-002`), NOT per replication_group_id. Expose the
# member-cluster IDs so the monitoring module can loop and create per-node alarms.
output "node_ids" {
  description = "Set of CacheClusterId values (node IDs). For a replication group these are the member clusters; for a single cluster it's just one id."
  value = toset(
    var.replication_enabled
      ? aws_elasticache_replication_group.rg[0].member_clusters
      : [aws_elasticache_cluster.single[0].id]
  )
}

output "security_group_id" {
  value = aws_security_group.redis.id
}
