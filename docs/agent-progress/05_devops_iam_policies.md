# MaKIT — IAM Policy Documents

**Author**: devops-engineer
**Date**: 2026-04-20
**Status**: Draft for AWS console application

Three roles are required. Names are suggestions; adjust to your account conventions.

| Role | Principal | Purpose |
|---|---|---|
| `makit-ecs-task-execution-role` | `ecs-tasks.amazonaws.com` | Pull ECR images, write CloudWatch logs, read secrets at task startup. |
| `makit-ecs-task-role`           | `ecs-tasks.amazonaws.com` | What the running app can do (Bedrock, S3, SecretsManager, Logs). |
| `makit-github-oidc-role`        | GitHub OIDC (`token.actions.githubusercontent.com`) | CI/CD: push to ECR, force-new-deployment ECS. |

---

## 1. ECS Task Execution Role

Attach AWS managed `AmazonECSTaskExecutionRolePolicy`, plus this inline policy for Secrets Manager (task definition `secrets:` injection):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PullFromECR",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Sid": "WriteExecutionLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/ecs/makit-*:*"
    },
    {
      "Sid": "InjectSecretsAtStart",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:makit/*"
    }
  ]
}
```

**Trust policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

---

## 2. ECS Task Role (application runtime)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeBedrock",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-*",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2*",
        "arn:aws:bedrock:*::foundation-model/amazon.titan-image-generator-*",
        "arn:aws:bedrock:*::foundation-model/stability.stable-diffusion-xl-*"
      ]
    },
    {
      "Sid": "S3AssetsRW",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::makit-assets",
        "arn:aws:s3:::makit-assets/*",
        "arn:aws:s3:::makit-assets-*",
        "arn:aws:s3:::makit-assets-*/*"
      ]
    },
    {
      "Sid": "AppLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/ecs/makit-*:*"
    },
    {
      "Sid": "ReadAppSecrets",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:makit/*"
    }
  ]
}
```

**Trust policy**: identical to Task Execution Role (principal `ecs-tasks.amazonaws.com`).

---

## 3. GitHub OIDC Deploy Role

Trust policy (replace `<ACCOUNT_ID>` and `<ORG>/<REPO>`; restrict `sub` to your repo & branch):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:ref:refs/heads/main"
      }
    }
  }]
}
```

Permission policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer"
      ],
      "Resource": [
        "arn:aws:ecr:*:*:repository/makit-backend",
        "arn:aws:ecr:*:*:repository/makit-frontend"
      ]
    },
    {
      "Sid": "EcrLogin",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "EcsRedeploy",
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:ListTaskDefinitions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleForTaskDef",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::<ACCOUNT_ID>:role/makit-ecs-task-execution-role",
        "arn:aws:iam::<ACCOUNT_ID>:role/makit-ecs-task-role"
      ]
    }
  ]
}
```

---

## Secrets Manager — key layout

Suggested secret naming to match IAM resource pattern `makit/*`:

| Secret name | Value |
|---|---|
| `makit/jwt-secret`        | `JWT_SECRET` plaintext |
| `makit/db-password`       | DB password |
| `makit/aws-bedrock-keys`  | *(only if not using task role — prefer task role)* |

In ECS task definition, reference as:
```json
"secrets": [
  { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:<ACCOUNT>:secret:makit/jwt-secret" },
  { "name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:<ACCOUNT>:secret:makit/db-password" }
]
```

---

## GitHub secrets to set

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN`  | `arn:aws:iam::<ACCOUNT_ID>:role/makit-github-oidc-role` |
| `ECR_REGISTRY`  | `<ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com` |
