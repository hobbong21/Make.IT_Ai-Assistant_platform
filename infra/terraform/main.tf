###############################################################################
# MaKIT — Root Terraform configuration
#
# State backend: S3 + DynamoDB lock table. The state bucket and lock table
# MUST be bootstrapped manually once per AWS account (see README.md §Bootstrap).
#
# The backend block below is partial; supply `-backend-config=` values at
# `terraform init` time so the same root can target dev/staging/prod.
###############################################################################

terraform {
  backend "s3" {
    # bucket         = "makit-tfstate-<account>"
    # key            = "makit/<env>/terraform.tfstate"
    # region         = "ap-northeast-2"
    # dynamodb_table = "makit-tfstate-lock"
    # encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MaKIT"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner
    }
  }
}

locals {
  name_prefix = "makit-${var.environment}"
  common_tags = {
    Project     = "MaKIT"
    Environment = var.environment
  }
}

###############################################################################
# Modules
###############################################################################

module "network" {
  source = "./modules/network"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  public_subnets     = var.public_subnet_cidrs
  private_subnets    = var.private_subnet_cidrs
  single_nat_gateway = var.environment == "prod" ? false : true
  tags               = local.common_tags
}

module "ecr" {
  source = "./modules/ecr"

  repository_names = ["makit-backend", "makit-frontend"]
  keep_image_count = 10
  tags             = local.common_tags
}

module "secrets" {
  source = "./modules/secrets"

  name_prefix     = local.name_prefix
  environment     = var.environment
  generate_values = var.generate_secret_values
  tags            = local.common_tags
}

module "iam" {
  source = "./modules/iam"

  name_prefix          = local.name_prefix
  github_org_repo      = var.github_org_repo
  github_branch        = var.github_deploy_branch
  create_oidc_provider = var.create_github_oidc_provider
  s3_bucket_arn        = module.s3_assets.bucket_arn
  secrets_arn_pattern  = "arn:aws:secretsmanager:${var.aws_region}:*:secret:makit/*"
  tfstate_bucket_name  = var.tfstate_bucket_name
  tfstate_lock_table   = var.tfstate_lock_table
  tags                 = local.common_tags
}

module "s3_assets" {
  source = "./modules/s3"

  bucket_name = "${local.name_prefix}-assets"
  environment = var.environment
  tags        = local.common_tags
}

module "rds" {
  source = "./modules/rds"

  name_prefix                 = local.name_prefix
  environment                 = var.environment
  vpc_id                      = module.network.vpc_id
  subnet_ids                  = module.network.private_subnet_ids
  ingress_security_group_ids  = [module.network.ecs_backend_security_group_id]
  instance_class              = var.rds_instance_class
  allocated_storage_gb        = var.rds_allocated_storage_gb
  max_allocated_storage_gb    = var.rds_max_allocated_storage_gb
  backup_retention_days       = var.environment == "prod" ? 30 : 7
  multi_az                    = var.environment == "prod"
  performance_insights_enabled = var.environment == "prod"
  skip_final_snapshot         = var.environment == "dev"
  db_name                     = var.db_name
  db_username                 = var.db_username
  db_password_secret_arn      = module.secrets.db_password_arn
  tags                        = local.common_tags
}

module "elasticache" {
  source = "./modules/elasticache"

  name_prefix                = local.name_prefix
  environment                = var.environment
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  ingress_security_group_ids = [module.network.ecs_backend_security_group_id]
  node_type                  = var.redis_node_type
  auth_token_secret_arn      = module.secrets.redis_auth_token_arn
  replication_enabled        = var.environment == "prod"
  tags                       = local.common_tags
}

module "ecs" {
  source = "./modules/ecs"

  name_prefix                 = local.name_prefix
  environment                 = var.environment
  aws_region                  = var.aws_region
  vpc_id                      = module.network.vpc_id
  public_subnet_ids           = module.network.public_subnet_ids
  private_subnet_ids          = module.network.private_subnet_ids
  alb_security_group_id       = module.network.alb_security_group_id
  backend_security_group_id   = module.network.ecs_backend_security_group_id
  frontend_security_group_id  = module.network.ecs_frontend_security_group_id
  ecr_backend_repo_url        = module.ecr.repository_urls["makit-backend"]
  ecr_frontend_repo_url       = module.ecr.repository_urls["makit-frontend"]
  backend_image_tag           = var.backend_image_tag
  frontend_image_tag          = var.frontend_image_tag
  task_execution_role_arn     = module.iam.ecs_task_execution_role_arn
  task_role_arn               = module.iam.ecs_task_role_arn
  backend_cpu                 = var.ecs_backend_cpu
  backend_memory              = var.ecs_backend_memory
  frontend_cpu                = var.ecs_frontend_cpu
  frontend_memory             = var.ecs_frontend_memory
  desired_count_backend       = var.ecs_desired_count_backend
  desired_count_frontend      = var.ecs_desired_count_frontend
  max_count_backend           = var.ecs_max_count_backend
  max_count_frontend          = var.ecs_max_count_frontend
  certificate_arn             = var.acm_certificate_arn
  jwt_secret_arn              = module.secrets.jwt_secret_arn
  db_password_secret_arn      = module.secrets.db_password_arn
  redis_auth_token_secret_arn = module.secrets.redis_auth_token_arn
  db_endpoint                 = module.rds.endpoint
  db_name                     = var.db_name
  db_username                 = var.db_username
  redis_endpoint              = module.elasticache.primary_endpoint
  redis_port                  = module.elasticache.port
  s3_bucket_name              = module.s3_assets.bucket_name
  log_retention_days          = var.environment == "prod" ? 90 : 14
  cors_allowed_origins        = var.cors_allowed_origins
  jwt_issuer                  = var.jwt_issuer
  jwt_audience                = var.jwt_audience
  tags                        = local.common_tags
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix              = local.name_prefix
  environment              = var.environment
  aws_region               = var.aws_region
  alarm_email_subscribers  = var.alarm_email_subscribers
  backend_log_group_name   = module.ecs.backend_log_group_name
  frontend_log_group_name  = module.ecs.frontend_log_group_name
  ecs_cluster_name         = module.ecs.cluster_name
  backend_service_name     = module.ecs.backend_service_name
  frontend_service_name    = module.ecs.frontend_service_name
  backend_target_group_arn_suffix = module.ecs.backend_target_group_arn_suffix
  alb_arn_suffix           = module.ecs.alb_arn_suffix
  rds_instance_id          = module.rds.instance_id
  redis_cluster_id         = module.elasticache.cluster_id
  redis_node_ids           = module.elasticache.node_ids
  bedrock_daily_cost_usd_threshold = var.bedrock_daily_cost_usd_threshold
  tags                     = local.common_tags
}
