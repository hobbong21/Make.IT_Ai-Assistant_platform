variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "ingress_security_group_ids" {
  type = list(string)
}

variable "node_type" {
  type = string
}

variable "auth_token_secret_arn" {
  type = string
}

variable "replication_enabled" {
  description = "Use replication group with auth + automatic failover (required for prod)."
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
