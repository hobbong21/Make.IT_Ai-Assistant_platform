# Harness Evolution Report — MaKIT v1 → v1-ops

- **일자**: 2026-04-23
- **적용자**: `/harness:evolve` (수동 실행, Phase 7 — 운영/유지보수 워크플로우)
- **대상 하네스**: `makit-dev-orchestrator` + 6 agents + 5 도메인 스킬
- **초기 버전**: 2026-04-20 (초기 구성)
- **현재 버전**: 2026-04-21 (v1 빌드 + QA 2라운드 + 잔여 MINOR + 운영 준비 + tfstate 부트스트랩)

---

## 1. 델타 요약

| 영역 | 초기 하네스 정의 | 실제 운영 진입 상태 |
|------|------------------|----------------------|
| Backend Java 파일 | 초기 구축: ~128 | **133** (+5: Seeder/RateLimit/S3Uploader/MDC/RequestId) |
| Spring profile | `application-{default,docker,prod}.yml` | **+2**: `application-mock.yml`, `application-prod-aws.yml` |
| AI 레이어 | 인터페이스 + 기본 구현 | **+6**: InjectionGuard · HealthIndicator · FallbackProps · InvocationException · MockBedrockService · PromptVariant |
| AI 스트리밍 | 플레이스홀더 | **실 SSE 스트리밍** (`ChatStreamChunk`) |
| RAG | 개요만 | **pgvector 실구현** (`PgVectorKnowledgeRetriever`, `TextChunker`) |
| Infra | docker-compose 위주 | **Terraform 9 모듈 35 파일** (ecr/ecs/elasticache/iam/monitoring/network/rds/s3/secrets) + 3 env tfvars |
| 관측성 | CloudWatch 메트릭 개념 | **SNS + 7 알람 + 대시보드** (terraform `monitoring` 모듈) |
| 배포 부트스트랩 | 없음 | **`scripts/bootstrap-tfstate.{sh,ps1}`** (bash + PowerShell 크로스 플랫폼) |
| QA | Incremental 경계 검증 (5 경계) | **+ PRR 라운드** (4 BLOCKER + 9 MAJOR → 11/11 CONFIRMED FIXED) |
| 프론트 중복 | 3곳 중복 (root/frontend/Mokup) | **정리 완료** — 루트 9파일 삭제, `frontend/` 정식 소스 |
| Flyway | 예시만 | **10 파일** (`V00000001__init_extensions` + 9 도메인 테이블, `V{YYYYMMDDHHMM}__` 네이밍) |

---

## 2. 피드백 유형별 매핑 (무엇이 하네스로 되먹여져야 하는가)

### 2.1 운영 강화 패턴 (backend-engineer → 체화)

초기 "인증 + 예외 처리" 수준을 넘어 **실서비스 런타임**에 필요한 cross-cutting 레이어가 추가됨:

| 산출물 | 학습된 원칙 |
|--------|-------------|
| `RateLimitFilter` | 외부 노출 엔드포인트는 IP/계정별 레이트리밋이 기본 |
| `RequestIdFilter` + `LoggingMdcFilter` | 모든 요청에 correlationId + MDC 컨텍스트 주입 (로그 추적성) |
| `DemoUserSeeder` | 데모/개발 프로파일에서 시드 계정 자동 생성 — QA/시연 가속 |
| `application-mock.yml` | Bedrock 미사용 오프라인 개발 모드 |
| `application-prod-aws.yml` | 프로덕션 프로파일은 AWS 전용으로 분리 (IAM role 기반, 시크릿 매니저) |
| `DefaultS3ImageUploader` | 프로덕션 S3 업로더(IAM 역할) vs 개발 NoOp — 인터페이스 + 프로파일 분기 |

### 2.2 AI 안전/관측성 패턴 (ai-engineer → 체화)

| 산출물 | 학습된 원칙 |
|--------|-------------|
| `PromptInjectionGuard` | 사용자 입력 프롬프트는 주입 공격 전처리 필수 (Claude system prompt만으로는 부족) |
| `BedrockHealthIndicator` | Bedrock 연결성을 Spring Actuator `/actuator/health`로 노출 |
| `BedrockFallbackProperties` + `MockBedrockService` | 프로파일별 Bedrock fallback — 오프라인·자격증명 부재 시 |
| `BedrockInvocationException` | Bedrock 실패를 typed 예외로 전파하여 상위에서 분기 가능 |
| `PromptVariantProperties` + 프롬프트 버전 디렉토리 | 프롬프트 A/B 또는 점진적 배포를 코드 변경 없이 |
| `ChatStreamChunk` + SSE | 플레이스홀더가 아닌 실제 Bedrock 스트리밍 래퍼 |

### 2.3 인프라 성숙 패턴 (devops-engineer → 체화)

| 산출물 | 학습된 원칙 |
|--------|-------------|
| `infra/terraform/modules/*` 9개 | 처음부터 **모듈 단위** 분해 (network/ecr/ecs/rds/elasticache/s3/iam/secrets/monitoring). 한 monolith tf 금지 |
| `infra/terraform/envs/{dev,staging,prod}.tfvars` | 환경별 tfvars 분리. 환경 = 파일, 모듈 = 재사용 |
| `monitoring` 모듈 (SNS + 7 알람 + 대시보드) | 모니터링은 **인프라 코드**에 포함. 런타임 앱이 아닌 IaC |
| `scripts/bootstrap-tfstate.{sh,ps1}` | tfstate S3 + DynamoDB lock은 **별도 부트스트랩**. Windows 팀원을 위해 PowerShell 병행 |
| 버전닝 + SSE + public-block + HTTPS-only | tfstate 버킷은 6가지 하드닝 디폴트 |
| DynamoDB PAY_PER_REQUEST | lock 테이블은 provisioned capacity 불필요 |

### 2.4 QA 심화 패턴 (qa-engineer → 체화)

초기 "5 경계면 교차 비교" 위에 **PRR(Production Readiness Review)**이 별도 라운드로 성립:

| PRR 범주 | 실제 발견된 이슈(요약) |
|----------|------------------------|
| 시크릿 관리 | 하드코딩 → Secrets Manager/Parameter Store 연동 |
| IAM 최소권한 | broad `*` → resource·action 한정 |
| 프롬프트 주입 | InjectionGuard 도입 전 취약 |
| 헬스체크 누락 | Bedrock 외부 의존 Actuator 미노출 |
| Rate limit 부재 | 공개 API 무방비 |
| 관측성 공백 | 알람/대시보드 없음 → SNS + 7알람 |
| Flyway 순서 | 타임스탬프 네이밍 규약 확정 |

**결론**: 경계면 QA와 **별개의 Phase**로 PRR을 오케스트레이터에 명시해야 다음 세대가 누락하지 않는다.

### 2.5 프론트 정리 패턴 (frontend-engineer → 체화)

- 중복 파일(3곳 × 5 HTML = 최대 15개)은 **정식 소스 1곳 확립** → 나머지 삭제가 가능한 안전 경로임을 검증
- 사용자 승인 게이트 필수 (자동 삭제 금지)
- `0. Design1_Mokup/`은 **아카이브로 보존** (디자인 참조용 원본)

---

## 3. 진화 대상 파일 목록

| 파일 | 변경 유형 | 주요 추가 |
|------|----------|----------|
| `.claude/skills/makit-dev-orchestrator/SKILL.md` | **major** | Phase 5.5 PRR 신설, 산출물 경로 갱신(infra/terraform), 하이브리드 모드 표 Phase 5.5 행 추가 |
| `.claude/agents/backend-engineer.md` | **major** | 운영 강화 섹션 추가 (RateLimit·MDC·RequestId·Seeder·multi-profile), 프로파일 매트릭스, cross-cutting 체크리스트 |
| `.claude/agents/ai-engineer.md` | **major** | InjectionGuard·HealthIndicator·MockBedrock·PromptVariant·실SSE, fallback 전략 |
| `.claude/agents/devops-engineer.md` | **major** | Terraform 모듈 카탈로그, env tfvars, monitoring 모듈(SNS+알람+대시보드), tfstate 부트스트랩(bash+ps1) |
| `.claude/agents/qa-engineer.md` | **major** | PRR 섹션 추가 (경계면 QA와 별도), PRR 체크리스트 7범주 |
| `.claude/agents/frontend-engineer.md` | minor | 중복 정리 완료 상태 반영, `0. Design1_Mokup/` 아카이브 원칙 |
| `.claude/agents/architect.md` | minor | 확정된 ADR 목록(JWT·Postgres·multi-profile) 참조 추가 |
| `CLAUDE.md` | minor | 변경 이력에 2026-04-23 진화 항목 추가 |

스킬(`.claude/skills/{spring-boot-backend,bedrock-ai-integration,...}/SKILL.md`)은 **이번 라운드 범위 외** — 개별 진화는 후속 `/harness:evolve` 라운드에서.

---

## 4. 진화 이후 다음 세대(Next-Gen) 시작점

이 진화가 되먹여진 후, 유사 도메인(Spring Boot + Bedrock + Docker/AWS) 하네스의 **초안**은 아래 상태에서 시작해야 한다:

1. backend-engineer 에이전트가 첫 구현 시 RateLimit/MDC/RequestId/Seeder를 **기본 포함**으로 계획
2. ai-engineer가 InjectionGuard + HealthIndicator를 **1차 산출물**로 포함
3. devops-engineer가 Terraform 9모듈 뼈대 + tfstate 부트스트랩 스크립트를 **Phase 3 시작 시점**에 제안
4. 오케스트레이터가 Phase 4 (경계 QA) 이후 Phase 5.5 (PRR)을 **생략 불가 단계**로 실행
5. frontend-engineer가 중복 파일 감지 시 "정식 소스 확립 → 사용자 승인 → 삭제" 시퀀스를 기본값으로

---

## 5. 미적용 / 차기 라운드 이월

- 5개 도메인 스킬의 Progressive Disclosure 재구성 (참조 파일 분할) — v1.2 스타일
- 스킬 테스트(with-skill vs without-skill) 비교 측정 자동화
- CI에 `mvn verify` + terraform `plan` 게이트 통합 — 현재 devops-engineer 문서에 계획만 존재
