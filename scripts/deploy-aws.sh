#!/usr/bin/env bash
# MaKIT AWS deploy — build, push to ECR, force ECS redeploy.
set -euo pipefail

: "${AWS_REGION:=ap-northeast-2}"
: "${ECR_REGISTRY:?ECR_REGISTRY required (e.g. 123456789012.dkr.ecr.ap-northeast-2.amazonaws.com)}"
: "${ECS_CLUSTER:=makit-cluster}"
: "${ECS_SERVICE:=makit-service}"

TAG="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[*] Region       : $AWS_REGION"
echo "[*] ECR registry : $ECR_REGISTRY"
echo "[*] ECS cluster  : $ECS_CLUSTER"
echo "[*] ECS service  : $ECS_SERVICE"
echo "[*] Tag          : $TAG"

echo "[*] ECR login"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "[*] Build & push backend"
docker build -t "$ECR_REGISTRY/makit-backend:$TAG" ./backend
docker tag   "$ECR_REGISTRY/makit-backend:$TAG"   "$ECR_REGISTRY/makit-backend:latest"
docker push  "$ECR_REGISTRY/makit-backend:$TAG"
docker push  "$ECR_REGISTRY/makit-backend:latest"

echo "[*] Build & push frontend"
docker build -t "$ECR_REGISTRY/makit-frontend:$TAG" .
docker tag   "$ECR_REGISTRY/makit-frontend:$TAG"   "$ECR_REGISTRY/makit-frontend:latest"
docker push  "$ECR_REGISTRY/makit-frontend:$TAG"
docker push  "$ECR_REGISTRY/makit-frontend:latest"

echo "[*] ECS force-new-deployment"
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment \
  --region "$AWS_REGION" \
  >/dev/null

echo ""
echo "[+] Deployed $TAG to ECS $ECS_CLUSTER/$ECS_SERVICE"
echo "    Monitor: https://${AWS_REGION}.console.aws.amazon.com/ecs/v2/clusters/${ECS_CLUSTER}/services/${ECS_SERVICE}/events"
