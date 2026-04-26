variable "name_prefix" {
  type = string
}

variable "github_org_repo" {
  description = "GitHub org/repo path (e.g. my-org/makit)."
  type        = string
}

variable "github_branch" {
  description = "Branch allowed to assume the deploy role."
  type        = string
  default     = "main"
}

variable "create_oidc_provider" {
  description = "If true, create the GitHub OIDC provider. Set false if it already exists in the account."
  type        = bool
  default     = true
}

variable "s3_bucket_arn" {
  description = "ARN of the S3 assets bucket (for Task Role R/W)."
  type        = string
}

variable "secrets_arn_pattern" {
  description = "Secrets Manager ARN pattern (wildcard) the task role may read."
  type        = string
}

variable "tfstate_bucket_name" {
  type = string
}

variable "tfstate_lock_table" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
