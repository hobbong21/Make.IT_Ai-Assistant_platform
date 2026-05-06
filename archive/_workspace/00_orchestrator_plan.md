# MaKIT Dev Orchestrator — Execution Plan

**Start**: 2026-04-20
**Mode**: Initial execution (no prior `_workspace/`)
**Scope**: 3 domains 전체 + 백엔드 신규 구축 + 프론트 API 연동 + Docker/AWS 배포 + 통합 QA

## Phase 0 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| `_workspace/` | 없음 | 초기 실행 |
| `backend/` 디렉토리 | **없음** | 신규 생성 필요 (docker-compose가 참조하나 실재 X) |
| `.claude/agents/` | 존재 (6명) | architect/backend/ai/frontend/devops/qa |
| `.claude/skills/` | 존재 (6개) | orchestrator + 5 도메인 스킬 |
| `CLAUDE.md` | 존재 | 하네스 포인터 등록됨 |

## Phase 1: 도메인 분석

### 범위
- **도메인**: AX Data Intelligence / AX Marketing Intelligence / AX Commerce Brain (전체)
- **기술 스택** (README 기준 고정):
  - Java 21 + Spring Boot 3.2.0
  - PostgreSQL 15 (+ Flyway, pgvector)
  - Redis 7
  - AWS Bedrock (Claude/Titan/Stable Diffusion)
  - Docker + docker-compose + AWS ECS

### 식별된 위험 이슈
| # | 이슈 | 담당 | 우선순위 |
|---|------|------|---------|
| R1 | `backend/` 자체가 없음 — docker-compose가 참조만 함 | backend-engineer + devops-engineer | Blocker |
| R2 | 프론트 파일 3곳 중복 (`/`, `/frontend/`, `/0. Design1_Mokup/`) | frontend-engineer | Major |
| R3 | `login.html`이 `localhost:8083/api` 호출, docker-compose는 8080 노출 | frontend + backend (포트 합의) | Major |
| R4 | docker-compose에 Redis 누락 (캐싱·세션 필요) | devops-engineer | Major |
| R5 | AWS 자격증명 확보 불확실 — Bedrock 실 호출 못할 수 있음 | ai-engineer (mock fallback 준비) | Minor |
| R6 | `application.yml` 없음 (profile별 분리 필요) | backend-engineer | Major |
| R7 | Swagger/OpenAPI 설정 없음 | backend-engineer | Minor |
| R8 | 프론트 JS가 페이지별로 인라인 `<script>` — 공통화 필요 | frontend-engineer | Minor |

### 사용자 숙련도 감지
- 요청이 간결·명확 ("3개 도메인 전체", "이 상태로 개발 시작") → **중급 이상 개발자** 추정
- 기술 용어(JPA, Bedrock, RAG, ECS) 부담 없이 사용 가능
- 리포트/문서는 요약 우선, 상세는 참조 링크로

## Phase 2 계획 (다음 단계)

**실행 모드**: 서브 에이전트 (architect 단독)

**산출 목표**:
1. `_workspace/01_architect_system_design.md` — Mermaid 아키텍처 + 모듈 경계
2. `_workspace/01_architect_api_contracts.md` — OpenAPI 3.0 (3도메인 전체 엔드포인트)
3. `_workspace/01_architect_data_model.md` — JPA Entity + ERD
4. `_workspace/01_architect_adr/` — 주요 결정 ADR (vector DB 선택, 인증 방식 등)

## Phase 3 계획 (Phase 2 완료 후)

**실행 모드**: 에이전트 팀 (4명: backend, ai, frontend, devops)

**Task 의존관계**:
```
[ai-engineer] Task 1: AI 인터페이스 파일 (backend 차단)
       ↓
[backend-engineer] Task 2: auth + common + config
                   Task 3: data 도메인 (Task 2 후)
                   Task 4: marketing 도메인 (Task 2 후)
                   Task 5: commerce 도메인 (Task 2 후)
[ai-engineer]      Task 6: Bedrock 구현체 + 프롬프트 (Task 1 후)
                   Task 7: RAG 파이프라인 (Task 1 후)
[devops-engineer]  Task 8: backend/Dockerfile + compose 개정 (병렬)
                   Task 11: GitHub Actions (Task 8 후)
[frontend-engineer] Task 9: api.js/auth.js/ui.js/common.css (Task 2 후)
                    Task 10: 페이지별 연결 (Task 3/4/5 후)
```

## Phase 4-5 계획

- Phase 4: 각 Task 완료 직후 qa-engineer가 해당 경계 즉시 검증
- Phase 5: `docker-compose up -d` 리허설 + 스모크 8개 시나리오 + `99_release_report.md`

## 다음 액션

**→ Phase 2 시작**: architect 서브 에이전트 디스패치
