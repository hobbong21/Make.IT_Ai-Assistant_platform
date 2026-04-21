###############################################################################
# IAM roles (mirror _workspace/05_devops_iam_policies.md):
#   1. ECS Task Execution Role
#   2. ECS Task Role (runtime app permissions: Bedrock, S3, Logs)
#   3. GitHub OIDC deploy role (ECR push, ECS update, Terraform state R/W)
###############################################################################

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

###############################################################################
# 1. ECS Task Execution Role
###############################################################################

data "aws_iam_policy_document" "task_execution_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.name_prefix}-ecs-task-execution-role"
  assume_role_policy = data.aws_iam_policy_document.task_execution_trust.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "task_execution_inline" {
  statement {
    sid = "PullFromECR"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage"
    ]
    resources = ["*"]
  }

  statement {
    sid       = "WriteExecutionLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:${data.aws_partition.current.partition}:logs:*:*:log-group:/ecs/makit-*:*"]
  }

  statement {
    sid       = "InjectSecretsAtStart"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.secrets_arn_pattern]
  }
}

resource "aws_iam_role_policy" "task_execution_inline" {
  name   = "${var.name_prefix}-task-execution-inline"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.task_execution_inline.json
}

###############################################################################
# 2. ECS Task Role (runtime app)
###############################################################################

resource "aws_iam_role" "task" {
  name               = "${var.name_prefix}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.task_execution_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "task_inline" {
  statement {
    sid = "InvokeBedrock"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/anthropic.claude-3-haiku-*",
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/amazon.titan-embed-text-v2*",
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/amazon.titan-image-generator-*",
      "arn:${data.aws_partition.current.partition}:bedrock:*::foundation-model/stability.stable-diffusion-xl-*"
    ]
  }

  # PRR-025 fix: BedrockHealthIndicator calls bedrock:ListFoundationModels (control plane).
  # Without this, /actuator/health/bedrock returns DOWN → ALB 503 → rollback loop.
  statement {
    sid       = "BedrockList"
    actions   = ["bedrock:ListFoundationModels"]
    resources = ["*"]
  }

  statement {
    sid = "S3AssetsRW"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListBucket"
    ]
    resources = [
      var.s3_bucket_arn,
      "${var.s3_bucket_arn}/*"
    ]
  }

  statement {
    sid = "AppLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ]
    resources = ["arn:${data.aws_partition.current.partition}:logs:*:*:log-group:/ecs/makit-*:*"]
  }

  statement {
    sid       = "ReadAppSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.secrets_arn_pattern]
  }

  statement {
    sid = "PublishCustomMetrics"
    actions = [
      "cloudwatch:PutMetricData"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "cloudwatch:namespace"
      values   = ["MaKIT/Bedrock", "MaKIT/App"]
    }
  }
}

resource "aws_iam_role_policy" "task_inline" {
  name   = "${var.name_prefix}-task-inline"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_inline.json
}

###############################################################################
# 3. GitHub OIDC deploy role
###############################################################################

# Note: the OIDC provider itself is account-wide and should be bootstrapped
# once per account (thumbprint managed by AWS). If it already exists, comment
# this resource out and import or use a data source.
resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = var.tags
}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : "arn:${data.aws_partition.current.partition}:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org_repo}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "github_oidc" {
  name               = "${var.name_prefix}-github-oidc-role"
  assume_role_policy = data.aws_iam_policy_document.github_trust.json
  tags               = var.tags
}

data "aws_iam_policy_document" "github_policy" {
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer"
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:ecr:*:*:repository/makit-backend",
      "arn:${data.aws_partition.current.partition}:ecr:*:*:repository/makit-frontend"
    ]
  }

  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "EcsRedeploy"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:ListTaskDefinitions",
      "ecs:DescribeClusters"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "PassRoleForTaskDef"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.task_execution.arn,
      aws_iam_role.task.arn
    ]
  }

  # Terraform state backend access — needed for `terraform apply` from CI
  statement {
    sid = "TfStateBucket"
    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:s3:::${var.tfstate_bucket_name}",
      "arn:${data.aws_partition.current.partition}:s3:::${var.tfstate_bucket_name}/*"
    ]
  }

  statement {
    sid = "TfStateLock"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable"
    ]
    resources = [
      "arn:${data.aws_partition.current.partition}:dynamodb:*:*:table/${var.tfstate_lock_table}"
    ]
  }

  # Needed so CI `terraform plan/apply` can read the infra it manages.
  # Narrow scope: describe / get only.
  statement {
    sid = "TerraformReadOnly"
    actions = [
      "ec2:Describe*",
      "elasticloadbalancing:Describe*",
      "rds:Describe*",
      "elasticache:Describe*",
      "logs:Describe*",
      "cloudwatch:Describe*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "iam:Get*",
      "iam:List*",
      "secretsmanager:Describe*",
      "secretsmanager:List*",
      "s3:GetBucket*",
      "s3:GetLifecycleConfiguration",
      "s3:GetEncryptionConfiguration",
      "ecr:Describe*",
      "ecr:Get*",
      "ecr:List*",
      "ecs:List*",
      "sns:Get*",
      "sns:List*"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_policy" {
  name   = "${var.name_prefix}-github-oidc-policy"
  role   = aws_iam_role.github_oidc.id
  policy = data.aws_iam_policy_document.github_policy.json
}
