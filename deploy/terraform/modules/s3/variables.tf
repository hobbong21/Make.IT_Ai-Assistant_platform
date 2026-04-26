variable "bucket_name" {
  description = "S3 bucket name (must be globally unique)."
  type        = string
}

variable "environment" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
