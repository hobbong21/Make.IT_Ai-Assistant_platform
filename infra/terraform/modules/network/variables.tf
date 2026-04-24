variable "name_prefix" {
  description = "Resource name prefix (e.g. makit-dev)."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block."
  type        = string
}

variable "availability_zones" {
  description = "List of AZs."
  type        = list(string)
}

variable "public_subnets" {
  description = "Public subnet CIDRs (one per AZ, same count as availability_zones)."
  type        = list(string)
}

variable "private_subnets" {
  description = "Private subnet CIDRs (one per AZ)."
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "If true, use one NAT for all AZs (cheaper). If false, one per AZ (HA)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags."
  type        = map(string)
  default     = {}
}
