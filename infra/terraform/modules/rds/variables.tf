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
  description = "SG IDs allowed to connect on 5432."
  type        = list(string)
}

variable "engine_version" {
  type    = string
  default = "15.6"
}

variable "instance_class" {
  type = string
}

variable "allocated_storage_gb" {
  type    = number
  default = 100
}

variable "max_allocated_storage_gb" {
  type    = number
  default = 500
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "multi_az" {
  type    = bool
  default = false
}

variable "performance_insights_enabled" {
  type    = bool
  default = false
}

variable "skip_final_snapshot" {
  type    = bool
  default = false
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password_secret_arn" {
  description = "ARN of Secrets Manager entry holding the master password."
  type        = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
