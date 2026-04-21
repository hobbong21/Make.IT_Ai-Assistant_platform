---
name: docker-aws-deploy
description: "MaKIT Docker/AWS 배포 가이드. 멀티스테이지 Dockerfile, docker-compose(Postgres+Redis+Backend+Nginx), GitHub Actions CI/CD, ECR/ECS 배포, IAM, 시크릿 관리. 'Docker 빌드', '배포', 'CI/CD', 'docker-compose', 'AWS ECS', 'GitHub Actions', '환경 변수' 관련 요청 시 반드시 이 스킬을 사용할 것."
---

# Docker & AWS Deploy — 인프라·CI/CD 가이드

## 언제 사용하나

- `backend/Dockerfile` 신규 작성 (현재 없음)
- `docker-compose.yml` 개정 (Redis 누락, 프로필 분리)
- GitHub Actions 워크플로우 (테스트·이미지 빌드·ECR 푸시·ECS 배포)
- `scripts/setup.sh`, `scripts/deploy-aws.sh` 작성/수정
- 환경변수 템플릿(`.env.example`) 정비

## 디렉토리/파일 맵

```
프로젝트 루트/
├── Dockerfile                 (Nginx 프론트 — 이미 존재, 유지)
├── docker-compose.yml         (개정 필요)
├── docker-compose.override.yml (로컬 개발용, 신규)
├── .env.example               (신규)
├── .dockerignore              (신규)
├── backend/
│   └── Dockerfile             (신규)
├── scripts/
│   ├── setup.sh               (존재, 개정)
│   └── deploy-aws.sh          (존재, 개정)
└── .github/workflows/
    ├── docker-publish.yml     (존재, 확장)
    └── backend-test.yml       (신규 — PR 전용)
```

## backend/Dockerfile (신규)

```dockerfile
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# 의존성 캐시 레이어
COPY pom.xml .
RUN mvn -B dependency:go-offline

# 소스 복사 & 빌드
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache wget && \
    addgroup -S spring && adduser -S spring -G spring

COPY --from=build /build/target/*.jar app.jar
RUN chown spring:spring app.jar

USER spring

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health | grep -q '"status":"UP"' || exit 1

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
```

**목표 이미지 크기**: < 300MB

## 루트 Dockerfile (Nginx, 기존 유지 + 경로 수정)

```dockerfile
FROM nginx:alpine
COPY frontend/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` 신규 (인라인 heredoc 제거하고 파일 분리):
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # API 프록시
    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;   # 긴 AI 호출 대응
        proxy_buffering off;        # SSE 스트리밍 허용
    }

    # 헬스체크
    location = /healthz { return 200 'ok'; add_header Content-Type text/plain; }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 캐시
    location ~* \.(?:css|js|jpg|jpeg|png|gif|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

## docker-compose.yml (개정)

```yaml
services:
  database:
    image: postgres:15-alpine
    container_name: makit-db
    environment:
      POSTGRES_DB: ${DB_NAME:-makit}
      POSTGRES_USER: ${DB_USER:-makit_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks: [makit-network]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: makit-redis
    ports:
      - "6379:6379"
    networks: [makit-network]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    image: makit-backend:latest
    container_name: makit-backend
    environment:
      SPRING_PROFILES_ACTIVE: docker
      SPRING_DATASOURCE_URL: jdbc:postgresql://database:5432/${DB_NAME:-makit}
      SPRING_DATASOURCE_USERNAME: ${DB_USER:-makit_user}
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      SPRING_REDIS_HOST: redis
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      AWS_REGION: ${AWS_REGION:-ap-northeast-2}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:-}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:-}
      S3_BUCKET: ${S3_BUCKET:-makit-assets}
    ports:
      - "8080:8080"
    depends_on:
      database: { condition: service_healthy }
      redis:    { condition: service_healthy }
    networks: [makit-network]
    volumes:
      - ./logs:/app/logs

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    image: makit-frontend:latest
    container_name: makit-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks: [makit-network]

volumes:
  postgres_data:
    driver: local

networks:
  makit-network:
    driver: bridge
```

## docker-compose.override.yml (로컬 개발 전용)

```yaml
services:
  backend:
    volumes:
      - ./backend/src:/app/src:ro
    environment:
      SPRING_PROFILES_ACTIVE: docker,dev
      LOGGING_LEVEL_COM_HUMANAD_MAKIT: DEBUG
  database:
    ports:
      - "5432:5432"  # 로컬에서 DBeaver 접근
```

## .env.example

```bash
# Database
DB_NAME=makit
DB_USER=makit_user
DB_PASSWORD=change-me-in-prod

# JWT (최소 32자)
JWT_SECRET=change-this-to-a-secure-random-256bit-secret

# AWS
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=makit-assets

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```

`.gitignore`에 `.env` 포함 필수.

## .dockerignore

```
.git
.github
.claude
.idea
.vscode
target
logs
node_modules
*.md
0. Design1_Mokup
_workspace
```

## GitHub Actions: backend-test.yml (PR 전용)

```yaml
name: Backend Test
on:
  pull_request:
    paths: ['backend/**', 'pom.xml']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'
      - name: Test
        working-directory: backend
        run: mvn -B verify
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-reports
          path: backend/target/surefire-reports/
```

## GitHub Actions: docker-publish.yml (main 배포)

```yaml
name: Docker Build & Deploy
on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}
  ECS_CLUSTER: makit-cluster
  ECS_SERVICE: makit-service

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2

      - name: Build & push backend
        run: |
          docker build -t $ECR_REGISTRY/makit-backend:${{ github.sha }} ./backend
          docker tag $ECR_REGISTRY/makit-backend:${{ github.sha }} $ECR_REGISTRY/makit-backend:latest
          docker push $ECR_REGISTRY/makit-backend:${{ github.sha }}
          docker push $ECR_REGISTRY/makit-backend:latest

      - name: Build & push frontend
        run: |
          docker build -t $ECR_REGISTRY/makit-frontend:${{ github.sha }} .
          docker tag $ECR_REGISTRY/makit-frontend:${{ github.sha }} $ECR_REGISTRY/makit-frontend:latest
          docker push $ECR_REGISTRY/makit-frontend:${{ github.sha }}
          docker push $ECR_REGISTRY/makit-frontend:latest

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment
```

## scripts/setup.sh (로컬 셋업)

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[*] .env 생성. 값을 채운 뒤 다시 실행하세요."
  exit 1
fi

echo "[*] Docker 빌드"
docker-compose build

echo "[*] 스택 시작"
docker-compose up -d

echo "[*] 헬스체크 대기"
for i in {1..30}; do
  if curl -sf http://localhost:8080/actuator/health > /dev/null; then
    echo "[✓] Backend UP"
    break
  fi
  sleep 5
done

echo "Frontend: http://localhost"
echo "Backend : http://localhost:8080"
echo "Swagger : http://localhost:8080/swagger-ui.html"
```

## scripts/deploy-aws.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:=ap-northeast-2}"
: "${ECR_REGISTRY:?ECR_REGISTRY required}"
: "${ECS_CLUSTER:=makit-cluster}"
: "${ECS_SERVICE:=makit-service}"

TAG="${1:-latest}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[*] ECR 로그인"
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "[*] Backend 빌드/푸시 ($TAG)"
docker build -t "$ECR_REGISTRY/makit-backend:$TAG" ./backend
docker push "$ECR_REGISTRY/makit-backend:$TAG"

echo "[*] Frontend 빌드/푸시 ($TAG)"
docker build -t "$ECR_REGISTRY/makit-frontend:$TAG" .
docker push "$ECR_REGISTRY/makit-frontend:$TAG"

echo "[*] ECS 강제 재배포"
aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --force-new-deployment

echo "[✓] 완료. 콘솔에서 이벤트 모니터링: https://console.aws.amazon.com/ecs"
```

## IAM 정책 (ECS Task Role)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": ["arn:aws:bedrock:*::foundation-model/*"] },
    { "Effect": "Allow",
      "Action": ["s3:PutObject","s3:GetObject","s3:DeleteObject"],
      "Resource": "arn:aws:s3:::makit-assets/*" },
    { "Effect": "Allow",
      "Action": ["logs:CreateLogStream","logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:log-group:/ecs/makit-*" },
    { "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:makit/*" }
  ]
}
```

## 금지 사항

- 시크릿을 이미지에 굽기 (`ENV JWT_SECRET=xxx` 금지)
- `docker-compose up` 시 환경변수 기본값으로 약한 값 채우기 (`?required` 강제)
- root 유저로 컨테이너 실행
- `latest` 태그만으로 프로덕션 배포 (반드시 SHA 태그 병기)
- `--network host` 사용

## 롤백

```bash
aws ecs update-service \
  --cluster makit-cluster \
  --service makit-service \
  --task-definition makit-task:<PREVIOUS_REVISION>
```

이전 revision 번호는 ECS 콘솔 또는 `aws ecs list-task-definitions --family makit-task`로 확인.
