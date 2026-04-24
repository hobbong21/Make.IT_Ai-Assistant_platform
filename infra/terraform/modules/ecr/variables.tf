variable "repository_names" {
  description = "List of ECR repo names."
  type        = list(string)
}

variable "keep_image_count" {
  description = "Lifecycle — number of tagged images to keep."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Common tags."
  type        = map(string)
  default     = {}
}
