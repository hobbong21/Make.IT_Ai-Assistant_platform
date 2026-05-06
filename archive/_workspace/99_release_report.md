# MaKIT Release Report — Harness v1 Initial Build

**Date**: 2026-04-21
**Mode**: Initial execution
**Orchestrator**: `makit-dev-orchestrator`
**Result**: ✅ **GO for container smoke test** (all blockers resolved, static verification complete)

---

## 1. Executive Summary

MaKIT (Human.Ai.D AX 마케팅 플랫폼)의 개발 하네스 1차 실행이 완료되었습니다. 프론트엔드 목업 상태에서 시작하여 **3개 도메인 전체의 백엔드·AI 통합·프론트 연동·컨테이너 배포 스택**을 일관된 계약 위에 구축했습니다.

| 지표 | 값 |
|------|---|
| 에이전트 팀 | 6명 (architect, backend, ai, frontend, devops, qa) |
| 총 Agent 호출 | 7회 (Phase 2 × 1 + Phase 3 × 4 + Phase 4 × 2) |
| Backend Java 파일 | **128개** |
| Flyway 마이그레이션 | **10개** (pgvector/pgcrypto + 9 테이블) |
| AI 프롬프트 템플릿 | **8개** |
| Frontend JS 모듈 | **9개** (ES2020+, Vanilla) |
| Docker/Infra 파일 | **6개** (compose 2 + Dockerfile 2 + nginx.conf + .env.example) |
| `_workspace/` 산출 문서 | **18개** (설계 + ADR 3 + 진행로그 + QA 3) |
| QA 초기 발견 | 5 BLOCKER, 8 MAJOR, 9 MINOR |
| QA 재검증 결과 | **10/10 confirmed fixed, 0 regressions** |

---

## 2. 하네스 워크플로우 실행 이력

```
Phase 0 (컨텍스트 확인)     ─▶ _workspace/ 없음 → 초기 실행
Phase 1 (도메인 분석)       ─▶ 00_orchestrator_plan.md (이슈 R1-R8 식별)
Phase 2 (아키텍처 설계)     ─▶ architect 서브에이전트
                              → 01_architect_system_design.md (307 lines)
                              → 01_architect_api_contracts.md (827 lines OpenAPI)
                              → 01_architect_data_model.md (424 lines)
                              → 01_architect_adr/ (3 ADRs)
Phase 3 (병렬 구현, 4명)    ─▶ backend + ai + frontend + devops (background)
                              total 190+ 파일 생성
Phase 4 (QA 1차)            ─▶ qa-engineer 5 경계 교차 검증
                              → 5 BLOCKER / 8 MAJOR / 9 MINOR
Phase 4.5 (수정 라운드)     ─▶ backend-engineer 재디스패치
                              → 9 findings resolved
                              → 오케스트레이터 inline: docker-compose CORS env (QA-010)
Phase 4.6 (QA 재검증)       ─▶ qa-engineer round2
                              → 10/10 CONFIRMED FIXED, 0 regressions
Phase 5 (릴리스 리포트)     ─▶ 이 문서
```

---

## 3. 산출물 맵

### 3-1. 설계 문서 (`_workspace/01_architect_*`)

- **System Design**: Mermaid 아키텍처, 모듈 경계, AI Integration Layer 4 인터페이스, 비기능 요건 (지연 AI<15s 텍스트/<45s 이미지, 50 RPS), 보안 모델, CloudWatch 메트릭 키
- **API Contracts**: OpenAPI 3.0 — Auth(5) + Data(5) + Marketing(2) + Commerce(4) + Jobs(1) + Health(2) = **19 엔드포인트**
- **Data Model**: **11개 테이블** (users, audit_logs, conversation_contexts, chat_messages, knowledge_documents, knowledge_chunks, campaigns, campaign_analytics, contents, job_executions, reviews) + ERD + 인덱스 정당성
- **ADR-001**: pgvector 채택 (v1), OpenSearch v2 이관 경로
- **ADR-002**: 자체 HS256 JWT (15m access / 7d refresh, Redis jti blacklist), Cognito 마이그레이션 경로
- **ADR-003**: 비동기 정책 — 동기 <10s, 202+폴링 배치, SSE 챗봇 토큰 스트리밍, WebSocket v1 기각

### 3-2. Backend (`backend/`)

```
backend/
├── pom.xml                                    (Spring Boot 3.2, jjwt, bedrock SDK, resilience4j, testcontainers)
├── README.md, .gitignore
├── src/main/java/com/humanad/makit/           (128 Java files)
│   ├── MaKITApplication
│   ├── config/   (Security, Cors, Redis, OpenApi, Async, Jackson, MockUploader)
│   ├── common/   (ApiErrorResponse, MarKITException × 5 subclasses, GlobalExceptionHandler, PageResponse, RequestIdFilter)
│   ├── auth/     (JWT login/register/me/logout/refresh, Redis jti blacklist, role-based)
│   ├── data/     (DataIntelligenceController + nlp/, youtube/, url/ services)
│   ├── marketing/(feed/, image/, campaign/)
│   ├── commerce/ (ChatbotController + SSE, review, modelshot, knowledge)
│   ├── job/      (JobExecution entity + polling controller, JSONB input/output)
│   ├── audit/    (AuditLog + @Aspect for LOGIN/REGISTER/content)
│   └── ai/       (ai-engineer's 35 Java files — interfaces + Bedrock + RAG + pgvector + Mock)
├── src/main/resources/
│   ├── application.yml, application-docker.yml, application-prod.yml, application-mock.yml
│   ├── prompts/ (8 .md 템플릿)
│   └── db/migration/ (10 Flyway SQL)
└── src/test/java/ (JwtTokenProviderTest, AuthServiceTest, GlobalExceptionHandlerTest, ...)
```

**AI Integration Layer (`ai/`)**:
- 4 인터페이스: `ContentGenerationStrategy`, `ChatbotEngine`, `KnowledgeRetriever`, `EmbeddingService`
- 실구현: `BedrockService` (resilience4j + Micrometer), `ClaudeTextContentStrategy` (HIGH→Sonnet, 일반→Haiku), `StableDiffusionImageStrategy`, `TitanEmbeddingService`, `PgVectorKnowledgeRetriever` (JdbcTemplate + IVFFLAT), `RAGChatbotEngine`
- Mock: `MockBedrockService` (`aws.bedrock.enabled=false` 시 결정적 응답) — AWS 자격증명 없이도 로컬 개발/QA 가능

### 3-3. Frontend (`frontend/`)

```
frontend/
├── index.html, intro.html, login.html, all-services.html, service-detail.html
├── css/
│   ├── common.css  (로딩, 토스트, 에러 상태 — 신규)
│   └── styles.css, intro-styles.css, all-services-styles.css, service-detail-styles.css
└── js/
    ├── config.js   (포트 자동 감지: /api vs http://localhost:8083/api)
    ├── api.js      (전 엔드포인트 커버, JWT 자동 주입, 401 처리)
    ├── auth.js     (로그인 상태, 세션)
    ├── ui.js       (toast, loading, error render)
    └── pages/      (login, index, all-services, service-detail, chatbot SSE)
```

- **디자인 변경 0건** — 색상·레이아웃·타이포그래피 모두 원본 유지
- **SSE 챗봇**: `fetch().body.getReader()` + TextDecoder (Bearer 헤더 포함 가능), `delta/citation/done/error/ping` 이벤트
- 프런트 3곳 중복(root, /frontend/, /0. Design1_Mokup/): `frontend/`를 정식 소스로 확립. 루트 복사본은 `04_frontend_cleanup_notes.md`에 삭제 권고만 명시(파괴적 조작 미실행)

### 3-4. Infrastructure (root + `scripts/` + `.github/`)

- `backend/Dockerfile` — multi-stage, JRE 21 Alpine, 비루트 `spring` 유저, HEALTHCHECK, <300MB
- `Dockerfile` (Nginx) + `nginx.conf` — `/api/` 프록시(8083), SSE `proxy_buffering off` + 300s 타임아웃, SPA fallback, 정적 캐시 7d
- `docker-compose.yml` — `pgvector/pgvector:pg15` + `redis:7-alpine` + backend + frontend, `${VAR:?required}` 강제
- `docker-compose.override.yml` — 로컬 개발용 (볼륨 마운트, DEBUG 로그)
- `.env.example` — 모든 필수 키 포함 (CORS_ALLOWED_ORIGINS 포함)
- `.github/workflows/backend-test.yml` — PR 게이트 (Maven + Postgres service)
- `.github/workflows/docker-publish.yml` — main 브랜치 → OIDC → ECR push → ECS update
- `scripts/setup.sh` — `.env` 검증 → `docker-compose up -d` → 헬스체크 폴링
- `scripts/deploy-aws.sh` — ECR 로그인 → 이미지 푸시 → `ecs update-service --force-new-deployment`
- `_workspace/05_devops_iam_policies.md` — 3 IAM Role JSON (Task Execution, Task, GitHub OIDC)
- `_workspace/05_devops_runbook.md` — 로컬 실행 / 트러블슈팅 / 롤백 / 로그 조회

---

## 4. QA 결과 정합성 (Phase 4 전체)

### 4-1. 1차 QA — 경계별 발견

| 경계 | PASS | MINOR | MAJOR | BLOCKER |
|------|:----:|:-----:|:-----:|:-------:|
| 1. API ↔ Frontend | 8 | 2 | 2 | 0 |
| 2. AI ↔ Backend | 6 | 1 | 1 | 3 |
| 3. DB ↔ Entity | 12 | 3 | 2 | 1 |
| 4. Docker ↔ Runtime | 8 | 2 | 2 | 1 |
| 5. Nginx ↔ Backend | 4 | 1 | 1 | 0 |
| **합계** | **38** | **9** | **8** | **5** |

### 4-2. 핵심 블로커 및 해소 (round2 재검증 결과)

| ID | 설명 | 해소 방식 | 상태 |
|----|------|----------|------|
| QA-001 | `ContentGenerationStrategy` NoUniqueBean | `ContentStrategySelector` 추가, 7 Service가 Selector 주입 | ✅ |
| QA-002 | `aiExecutor` 중복 빈 | backend의 AsyncConfig에서 제거, AI 모듈만 소유 | ✅ |
| QA-003 | `BedrockProperties` 스키마 불일치 | ai-engineer snippet을 application.yml에 병합 (nested) | ✅ |
| QA-004 | 프롬프트 키 이름 불일치 | 8개 Service가 실제 파일명(`data/nlp/sentiment.md` 등) 사용 | ✅ |
| QA-005 | `knowledge_chunks` 스키마 드리프트 | 마이그레이션 재작성 — UUID PK + 11 컬럼 + IVFFLAT 인덱스 | ✅ |
| QA-006 | SSE `done` 이벤트에 `contextId` 누락 | `ChatbotStreamController`가 `injectContextId`로 주입 | ✅ |
| QA-007/010 | CORS 허용 origin 기본값 + compose env | `CorsConfig`가 env 읽고, compose가 pipe-through | ✅ |
| QA-008 | `allowedHeaders=*` + credentials 위반 | 명시적 헤더 리스트 (`Authorization, Content-Type, X-Request-Id`) | ✅ |
| QA-011 | Prometheus 의존성 누락 | `pom.xml`에 `micrometer-registry-prometheus` 추가 | ✅ |

### 4-3. 재검증 결론

> **10/10 CONFIRMED FIXED, 0 REGRESSIONS** — Phase 5 스모크 테스트 진행 GO.

### 4-4. 잔여 MINOR 처리

**오케스트레이터 inline 추가 해소 (2026-04-21):**

| ID | 조치 |
|----|------|
| QA-M10 | `docker-compose.yml`에서 `SPRING_REDIS_HOST/PORT`를 `${REDIS_HOST:-redis}` / `${REDIS_PORT:-6379}`로 변경 — `.env.example` 키가 이제 실제로 사용됨 |
| QA-M11 | 레거시 플랫 `text-model-id/image-model-id` 이미 backend-engineer 수정 라운드에서 제거됨 (재확인 완료) |
| QA-M14 | `nginx.conf`에서 `/actuator/health`, `/actuator/info`만 공개, 나머지 `/actuator/*`는 Docker 내부 네트워크(127/8, 10/8, 172.16/12, 192.168/16)로만 허용 → Prometheus 메트릭 외부 노출 차단 |
| 추가 | `.dockerignore`에 root 중복 HTML/CSS 9개 명시적 제외 (빌드 컨텍스트 최적화) |

**v1.1 백로그로 이관된 잔여 MINOR:**
- QA-M01 (Swagger tags 검증), QA-M02 (`ResponseEntity<?>` schema erasure), QA-M03 (job polling exponential backoff)
- QA-M04 (MockBedrockService 한글 키워드 매칭 개선), QA-M05 (`S3ImageUploader` 실제 구현)
- QA-M06 (실제 Bedrock 스트리밍), QA-M07 (`contents` 엔티티 추가 시점), QA-M08 (`ip_address INET`), QA-M09 (BCrypt 시드 해시 자동 생성), QA-M12/13 (설정 정비)

---

## 5. 스모크 테스트 가이드 (사용자 실행용)

컨테이너 빌드/기동은 Maven + Docker 환경이 필요하므로 하네스에서는 직접 실행하지 않았습니다. 아래 순서로 로컬 검증하세요.

### 5-1. 사전 준비 (1회)

```bash
cd "Make.IT_Ai-Assistant_platform-main/Make.IT_Ai-Assistant_platform-main"
cp .env.example .env
# .env 편집:
#   DB_PASSWORD=<강한 값>
#   JWT_SECRET=<32자 이상, openssl rand -base64 48 로 생성>
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET (선택 — 없으면 mock 프로필 활용)
```

### 5-2. 실행

```bash
./scripts/setup.sh
# docker-compose build → up -d → /actuator/health 폴링
```

### 5-3. 기대 결과 (8 시나리오)

| # | 절차 | 기대 |
|---|------|------|
| 1 | `docker-compose ps` | 4 서비스 모두 healthy (최대 5분) |
| 2 | `curl http://localhost:8083/actuator/health` | `{"status":"UP"}` |
| 3 | 브라우저 `http://localhost/login.html` | 로그인 페이지 렌더 |
| 4 | 데모 계정 로그인 | 토큰 수신 + `/index.html` 이동 |
| 5 | Swagger `http://localhost:8083/swagger-ui.html` | 19 엔드포인트 목록 |
| 6 | `curl POST /api/data/nlp/analyze` with JWT | 200 + NLP 결과 JSON (mock 프로필이면 결정적 응답) |
| 7 | service-detail 페이지에서 예시 질문 클릭 | 실제 API 호출 + 결과 렌더 |
| 8 | 챗봇 SSE | 토큰 단위 스트리밍 + `contextId` 연속성 |

### 5-4. AWS 실 배포 전 수동 작업 (runbook §9)

1. ECR 리포지토리 2개 생성: `makit-backend`, `makit-frontend`
2. ECS 클러스터 `makit-cluster` + 태스크 정의 + Fargate 서비스 (ALB 뒤)
3. RDS Postgres 15 + pgvector 확장 활성화
4. ElastiCache Redis 7
5. S3 버킷 `makit-assets-{env}`
6. IAM Role 3개 생성 (`05_devops_iam_policies.md` JSON 적용)
7. GitHub OIDC Provider 등록 + Secrets 설정: `AWS_ROLE_ARN`, `ECR_REGISTRY`
8. Secrets Manager: `makit/jwt-secret`, `makit/db-password`

---

## 6. 알려진 한계 & v1.1 백로그

### 6-1. 아키텍처/코드

- **실제 Bedrock 스트리밍**: 현재 RAG 응답은 서버 측 단일 응답을 SSE로 분할 전달. `InvokeModelWithResponseStream` 통합은 v1.1
- **대화 컨텍스트 영속화**: Redis 캐싱 통합 대기 (현재 메모리/JPA 이중화)
- **배경 제거 엔진**: Stable Diffusion Inpainting 임시 사용 → 전용 엔진 ADR 필요
- **`contents` 테이블 JPA 엔티티 미정의**: 콘텐츠 이력 엔드포인트 생길 때 추가

### 6-2. 운영

- **요금 관측**: `bedrock.cost.usd` 메트릭의 tariff 맵은 분기별 수동 갱신 필요
- **프로덕션 로그 집계**: CloudWatch Logs Insights 쿼리 템플릿 미작성

### 6-3. QA

- **엔드투엔드 테스트**: Cypress/Playwright 미도입 (단위+통합만)
- **성능 부하 테스트**: k6 시나리오 미작성

---

## 7. 하네스 진화 제안 (다음 실행 대비)

### 7-1. 성공한 패턴 (유지)

- **계약 우선(architect 먼저)** + **병렬 구현** — 4 에이전트 병렬 실행에서 경계 충돌이 제한적이었음
- **Incremental QA (경계면 교차 비교)** — 정적 검증만으로 5 블로커 포착, 런타임 도달 전 차단
- **버그 패턴 카탈로그** (`06_qa_bug_patterns.md` 9개 BP) — architect가 다음 실행 때 계약 수준에서 방지 가능

### 7-2. 개선 제안

- **P1**: Phase 3 프롬프트에 "bean 이름 중복 금지" + "프롬프트 파일명은 ai-engineer 산출 기준" 명시 → QA-001/002/004 사전 차단
- **P2**: architect의 Data Model에 **JPA 매핑 예시 코드 블록**을 포함하여 backend-engineer의 컬럼 타입 드리프트(QA-005) 차단
- **P3**: Phase 4의 경계 5(Nginx↔Backend) 검증 체크리스트를 `integration-qa` SKILL에 보완 — 프록시 trailing slash, SSE 타임아웃은 흔한 실수

### 7-3. CLAUDE.md 변경 이력 갱신 필요

다음 항목을 `CLAUDE.md` 변경 이력 테이블에 추가:

```
| 2026-04-21 | v1 초기 빌드 완료 | backend/ + frontend/js/ + docker-compose 등 | 초기 실행 성공, 5 블로커 해소, GO for smoke |
```

---

## 8. 피드백 요청 (사용자)

다음에 답변 주시면 v1.1 하네스 진화에 반영됩니다.

1. **팀 구성**: 6명이 적절했나요? 별도 **monitoring-engineer**가 필요할까요?
2. **범위**: 3 도메인 전체를 한 번에 실행한 선택이 맞았나요? 아니면 도메인별 단계 실행이 더 나았을까요?
3. **QA 엄격도**: 5 경계 전체 검증이 충분히 세밀했나요, 과했나요?
4. **Mock 프로필**: 실제 Bedrock 없이도 개발 가능하도록 한 결정이 유효한가요?
5. **누락된 도메인**: v1에서 빠진 기능 중 우선순위 높은 것 (예: SEO 분석, 퍼포먼스 분석, 다국어 지원)?

모든 피드백은 `CLAUDE.md` 변경 이력에 날짜와 함께 기록됩니다.

---

## 9. 참조

- **하네스 정의**: `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `CLAUDE.md`
- **설계**: `_workspace/01_architect_*`
- **구현 진행 로그**: `_workspace/02_backend_*, 03_ai_*, 04_frontend_*, 05_devops_*`
- **QA**: `_workspace/06_qa_*`
- **원본 하네스 스킬** (팩토리): `..\..\harness-main\harness-main\skills\harness\SKILL.md`

---

**End of Report**
