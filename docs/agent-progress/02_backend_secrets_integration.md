# Secrets Manager Integration — Operator Guide

Status: v1.0, 2026-04-20.
Target profile: `prod-aws` (extends `prod`).

## Decision

We chose the **"ECS injects Secrets Manager values as env vars"** approach over
embedding the AWS SDK (`SecretsManagerClient`) or Spring Cloud AWS Secrets
Manager config into the application.

### Why this path

1. **Zero code coupling to AWS.** The application reads `${JWT_SECRET}` the
   same way in every environment — local Docker, dev ECS, prod ECS, a future
   on-prem deployment. Operators can swap Secrets Manager for any other store
   without touching Java.
2. **No extra IAM plumbing inside the JVM.** ECS fetches the secret once at
   task start using the *task execution role* (not the task role), so the
   running app never needs `secretsmanager:GetSecretValue` itself.
3. **Smaller attack surface.** The SDK is not on the classpath, so a future
   vuln in `aws-sdk-secretsmanager` does not affect us.
4. **Faster cold starts.** No synchronous round-trip to Secrets Manager at
   `ApplicationContext` bootstrap.

## Required AWS Secrets

Create these in Secrets Manager (same region as the ECS cluster):

| Secret name (suggested)              | Shape        | Used by env var                 |
|--------------------------------------|--------------|---------------------------------|
| `makit/prod/jwt-secret`              | plain string | `JWT_SECRET`                    |
| `makit/prod/db-password`             | plain string | `DB_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` |
| `makit/prod/redis-password` (opt.)   | plain string | `REDIS_PASSWORD`                |

Constraints:

- `JWT_SECRET` **must be at least 32 characters** (256-bit entropy for HS256).
  `JwtTokenProvider` fails fast at startup with
  `IllegalStateException("JWT_SECRET must be >= 32 chars when profile=prod")`
  if this is violated.
- Generate with `openssl rand -base64 48` and store the result as-is.

## ECS Task Definition snippet

```json
{
  "family": "makit-backend-prod",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn":      "arn:aws:iam::123456789012:role/makit-backend-task",
  "containerDefinitions": [{
    "name":  "backend",
    "image": "123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/makit-backend:1.0.0",
    "environment": [
      { "name": "SPRING_PROFILES_ACTIVE", "value": "prod,prod-aws" },
      { "name": "AWS_REGION",             "value": "ap-northeast-2" }
    ],
    "secrets": [
      {
        "name":      "JWT_SECRET",
        "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:makit/prod/jwt-secret"
      },
      {
        "name":      "DB_PASSWORD",
        "valueFrom": "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:makit/prod/db-password"
      }
    ]
  }]
}
```

## IAM policy (attach to `ecsTaskExecutionRole`)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid":    "FetchMakITSecrets",
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": [
      "arn:aws:secretsmanager:ap-northeast-2:123456789012:secret:makit/prod/*"
    ]
  }]
}
```

Co-locate with the KMS decrypt permission if the secrets use a CMK:

```json
{
  "Effect": "Allow",
  "Action": ["kms:Decrypt"],
  "Resource": "arn:aws:kms:ap-northeast-2:123456789012:key/<key-id>",
  "Condition": {
    "StringEquals": { "kms:ViaService": "secretsmanager.ap-northeast-2.amazonaws.com" }
  }
}
```

## Rotation

- Use Secrets Manager automatic rotation for `DB_PASSWORD` with an RDS lambda
  rotator; the running ECS tasks keep the old password until they're replaced.
  Force a rolling deploy (`UpdateService --force-new-deployment`) after
  rotation completes.
- `JWT_SECRET` rotation: generate a new secret, put the new value in Secrets
  Manager, then roll the service. All existing JWTs become invalid — acceptable
  for emergency rotations, otherwise coordinate with a short overlap window by
  temporarily accepting both secrets (not implemented in v1 — add a
  `jwt.secret.previous` property when needed).

## Verification checklist

1. `aws ecs describe-tasks --task <task-arn> --query 'tasks[0].containers[0].lastStatus'` → `RUNNING`.
2. Tail CloudWatch log group `/ecs/makit-backend-prod`; the first lines should
   contain `Started MaKITApplication` and `Seeded demo users: 0` is **not**
   present (DemoUserSeeder is disabled under `prod-aws`).
3. Trigger a deliberately wrong `JWT_SECRET` (< 32 chars) in a canary task; the
   container should exit with status 1 and the log line
   `JWT_SECRET must be >= 32 chars when profile=prod`. Revert before going
   live.
4. `/actuator/health` returns `{"status":"UP"}` with no details.

## Fall-back: plain env vars

If Secrets Manager is unavailable (e.g., local / on-prem prod replica), the
profile works with raw env vars:

```bash
SPRING_PROFILES_ACTIVE=prod \
JWT_SECRET=$(openssl rand -base64 48) \
SPRING_DATASOURCE_PASSWORD=... \
java -jar makit.jar
```

`prod-aws` is additive, not required.
