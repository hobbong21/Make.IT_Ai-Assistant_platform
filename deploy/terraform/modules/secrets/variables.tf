variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "generate_values" {
  description = "When true, Terraform generates random initial values. Disable to set values out-of-band."
  type        = bool
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
