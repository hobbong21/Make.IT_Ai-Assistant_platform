---
name: makit-dev-orchestrator
description: "MaKIT(AX 마케팅 플랫폼) 개발 하네스의 메인 오케스트레이터. architect·backend·ai·frontend·devops·qa 6개 에이전트 팀을 조율하여 Spring Boot 백엔드, AWS Bedrock AI 통합, 프론트엔드 API 연동, Docker/AWS 배포, 통합 QA를 파이프라인+전문가 풀 하이브리드로 수행. 'MaKIT 개발', 'MaKIT 빌드', 'MaKIT 배포', 'AX 플랫폼 개발', '백엔드 구현해줘', '프론트 연결해줘', '새 서비스 추가', '기능 확장', '다시 실행', '재실행', '업데이트', '수정', '보완', '이전 결과 기반', '결과 개선' 관련 MaKIT 프로젝트 작업 시 반드시 이 스킬을 사용할 것."
---

# MaKIT Dev Orchestrator — 팀 리더 워크플로우

## 하네스 목적

Human.Ai.D의 MaKIT 플랫폼(AX Data Intelligence / AX Marketing Intelligence / AX Commerce Brain)을 **프론트 목업 상태에서 프로덕션 배포 가능 수준까지** 완성한다.

**실행 모드**: 에이전트 팀 (기본) + 하이브리드
- Phase 1-2: 파이프라인 (architect → 설계 확정)
- Phase 3: 팬아웃 (backend·ai·frontend·devops 병렬)
- Phase 4: 생성-검증 (구현 + incremental 경계 QA)
- Phase 5.5: **PRR** (Production Readiness Review — 운영 적합성 검증, 경계 QA와 별개 라운드)
- Phase 5: 스모크 테스트 + 배포 리허설

## Phase 0: 컨텍스트 확인 (후속 작업 대응)

작업 시작 전 반드시 수행:

1. `_workspace/` 디렉토리 존재 확인
2. 존재하면 → 기존 산출물 읽고 "부분 재실행 vs 새 실행" 판정:
   - 사용자가 "다시/재실행/업데이트/보완" → **부분 재실행** (해당 에이전트만 재호출)
   - 사용자가 완전히 새 요구사항 → `_workspace/` → `_workspace_prev_{date}/` 이동 후 새 실행
   - 사용자가 추가 요구 → 기존 산출물 유지하고 증분 작업
3. 존재하지 않으면 → **초기 실행** (전체 Phase 1부터)
4. `.claude/agents/`, `.claude/skills/`, `CLAUDE.md` 읽어 하네스 현황 감사 → 불일치 감지 시 사용자에게 먼저 보고

## 팀 구성

| 에이전트 | 타입 | 주 스킬 |
|---------|------|--------|
| `architect` | general-purpose | (내장 설계 원칙) |
| `backend-engineer` | general-purpose | `spring-boot-backend` |
| `ai-engineer` | general-purpose | `bedrock-ai-integration` |
| `frontend-engineer` | general-purpose | `frontend-integration` |
| `devops-engineer` | general-purpose | `docker-aws-deploy` |
| `qa-engineer` | general-purpose | `integration-qa` |

모든 에이전트는 `model: "opus"` 로 호출.

## 표준 워크플로우

### Phase 1: 도메인 분석 (리더 단독)

- 사용자 요청에서 범위 파악 (3 도메인 전체 / 특정 도메인 / 특정 기능)
- 기존 파일 확인:
  - `README.md` 설계 섹션 (이미 상당한 내용 존재)
  - 프론트 HTML 5종 (루트 + `/frontend/` + `/0. Design1_Mokup/` — 중복 파일 많음)
  - `docker-compose.yml` (backend 참조하나 디렉토리 없음)
- 위험 이슈 목록 작성:
  - 백엔드 디렉토리 자체 없음
  - 프론트 login.html의 API 포트 8083 vs compose 8080 불일치
  - 프론트 3곳 중복
- 산출물: `_workspace/00_orchestrator_plan.md`

### Phase 2: 팀 아키텍처 설계 (architect 단독)

**실행 모드**: 서브 에이전트 (단일 에이전트)

```
Agent(agent-type="general-purpose",
      model="opus",
      subagent_type="general-purpose",
      prompt="""
You are the 'architect' agent defined in .claude/agents/architect.md.
Read that file first. Then produce the following under _workspace/:
  01_architect_system_design.md
  01_architect_api_contracts.md (OpenAPI 3.0 YAML)
  01_architect_data_model.md
Work within the scope: all 3 domains (Data Intelligence / Marketing Intelligence / Commerce Brain).
Base your design on README.md's existing "설계 문서" section — extend, don't rewrite.
""")
```

architect 완료 → 산출물 검토 → 승인되면 Phase 3으로.

### Phase 3: 병렬 구현 (에이전트 팀 모드)

**실행 모드**: 에이전트 팀

```
TeamCreate(
  team_name="makit-dev",
  leader_instructions="""
    You lead the MaKIT development team. Coordinate these members:
    - backend-engineer (Spring Boot implementation)
    - ai-engineer (AWS Bedrock integration)
    - frontend-engineer (API wiring)
    - devops-engineer (Docker/AWS)
    Distribute tasks via TaskCreate. Members self-coordinate via SendMessage.
    Each should read .claude/agents/{name}.md for their role definition
    and use the skill specified there.
  """,
  members=[
    {name:"backend-engineer", type:"general-purpose", model:"opus"},
    {name:"ai-engineer", type:"general-purpose", model:"opus"},
    {name:"frontend-engineer", type:"general-purpose", model:"opus"},
    {name:"devops-engineer", type:"general-purpose", model:"opus"},
  ]
)
```

TaskCreate로 작업 분배 (의존관계 명시):

```
Task 1 [ai-engineer]: AI 인터페이스 파일 작성 (backend-engineer 차단 요인)
Task 2 [backend-engineer] depends_on=[1]: auth + common + config 레이어
Task 3 [backend-engineer] depends_on=[2]: data 도메인 Controller/Service/Repo
Task 4 [backend-engineer] depends_on=[2]: marketing 도메인
Task 5 [backend-engineer] depends_on=[2]: commerce 도메인
Task 6 [ai-engineer] depends_on=[1]: Bedrock 구현체 + 프롬프트
Task 7 [ai-engineer] depends_on=[1]: RAG 파이프라인 (pgvector 스키마 포함)
Task 8 [devops-engineer]: backend/Dockerfile + docker-compose 개정 (병렬 가능)
Task 9 [frontend-engineer] depends_on=[2]: api.js + auth.js + ui.js + common.css
Task 10 [frontend-engineer] depends_on=[3,4,5]: 페이지별 API 연결
Task 11 [devops-engineer] depends_on=[8]: GitHub Actions 워크플로우
```

팀원들은 `SendMessage`로 자체 조율 (예: backend-engineer가 ai-engineer에게 "인터페이스 파일 완성했나요?" 질의).

중간 산출물은 모두 `_workspace/`에 누적.

### Phase 4: Incremental QA (생성-검증 패턴)

각 Task 완료 직후, qa-engineer가 해당 경계를 검증:

- Task 2 완료 → 경계 3(DB↔Entity), 경계 4(Docker↔런타임) 검증
- Task 3/4/5 완료 → 경계 1(API↔Frontend은 Task 9/10 후), 경계 2(AI↔Backend)
- Task 9/10 완료 → 경계 1 최종

**QA 에이전트 호출** (Phase 3의 팀이 해체된 후 또는 팀 내에서):
```
Agent(subagent_type="general-purpose",
      model="opus",
      prompt="""
You are 'qa-engineer'. Read .claude/agents/qa-engineer.md and use skill 'integration-qa'.
Verify boundary: {경계번호}
Files to cross-read: {file list}
Output: _workspace/06_qa_report_{YYYY-MM-DD}_{boundary}.md
If bugs found, send detailed reproduction to the responsible agent via the team leader.
""")
```

버그 발견 → 해당 구현 에이전트가 수정 → QA 재검증.

### Phase 5.5: PRR — Production Readiness Review

경계면 QA(Phase 4)가 **기능 정합성**을 본다면 PRR은 **운영 적합성**을 본다. Phase 5 스모크 테스트 **전에** 반드시 수행한다.

**실행 모드**: 서브 에이전트 (qa-engineer 단독) + 필요 시 관련 구현자 wake-up

```
Agent(subagent_type="general-purpose",
      model="opus",
      prompt="""
You are 'qa-engineer'. Read .claude/agents/qa-engineer.md PRR sections.
Execute PRR round. Write:
  _workspace/08_prr_checklist.md (7-category template)
  _workspace/08_prr_coverage.md (backend/ai/devops 소관 매핑)
  _workspace/08_prr_report_{YYYY-MM-DD}.md (findings with BLOCKER/MAJOR/MINOR grades)

Each finding must include:
- grade (BLOCKER/MAJOR/MINOR)
- owner (backend-engineer / ai-engineer / devops-engineer)
- evidence (file:line or behavior)
- fix recommendation
""")
```

발견된 BLOCKER/MAJOR 항목 → 해당 구현 에이전트에 `SendMessage`로 수정 요청 → 수정 완료 → qa-engineer가 **재라운드** 실행(`08_prr_report_round2.md`) → "ALL CONFIRMED FIXED" 도달해야 Phase 5 GO.

**PRR 7 범주**:
1. 시크릿 관리 — 평문/하드코딩 검사
2. IAM 최소 권한 — `*` 남용 검사
3. AI 안전 — PromptInjectionGuard 커버리지
4. 헬스체크 — 외부 의존 Actuator 노출
5. Rate limit & 공격 표면 — 공개 API 보호
6. 관측성 — SNS/알람/대시보드/메트릭
7. IaC 하드닝 — tfstate 보안·마이그레이션 순서·actuator 제한

### Phase 5: 스모크 테스트 + 배포 준비

devops-engineer가 `scripts/setup.sh` 실행 리허설:
1. `docker-compose up -d` 성공
2. 6~7개 스모크 시나리오 통과 (integration-qa SKILL 참고)
3. 최종 리포트 `_workspace/99_release_report.md`

## 데이터 전달 프로토콜

**권장 조합**: 태스크 기반(조율) + 파일 기반(산출물) + 메시지 기반(소통)

- 태스크: `TaskCreate`/`TaskUpdate`로 팀 공유 목록 관리
- 파일: `_workspace/{phase}_{agent}_{artifact}.md` 네이밍
  - `01_architect_*` → 설계
  - `02_backend_*` → 백엔드 진행
  - `03_ai_*` → AI 결정
  - `04_frontend_*` → 프론트 진행
  - `05_devops_*` → 인프라 런북
  - `06_qa_*` → QA 리포트
  - `99_release_report.md` → 최종
- 메시지: 의사결정·질의·경계 버그 보고

**최종 산출물 경로** (사용자 지정):
- `backend/**` — Spring Boot 프로젝트 (5 프로파일 포함)
- `frontend/**` — 정리된 프론트 (정식 소스)
- `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `.env.example`, `.dockerignore`
- `scripts/setup.sh`, `scripts/deploy-aws.sh`, `scripts/bootstrap-tfstate.{sh,ps1}`
- `.github/workflows/*.yml`
- `infra/terraform/` — 9 모듈 + envs/{dev,staging,prod}.tfvars

중간 파일(`_workspace/`)은 보존 — 사후 감사·재실행에 사용. PRR 결과물(`08_prr_*`)과 진화 리포트(`07_harness_evolution_*.md`)는 특히 다음 세대 하네스 개선을 위한 핵심 입력.

## 에러 핸들링

| 에러 유형 | 처리 |
|----------|------|
| 에이전트 1회 재시도 후 재실패 | 해당 결과 없이 진행 + `_workspace/99_release_report.md`에 누락 명시 |
| 상충 데이터 (architect vs 기존 README) | 양쪽 모두 기록. ADR로 결정. 사용자에게 최종 확인. |
| QA 버그 지속 (3회 이상 수정 실패) | 리더가 개입 — 계약(architect) 레벨 재설계 |
| 외부 의존(AWS, Bedrock) 불능 | devops-engineer가 mock/LocalStack 대체안 제시, 실제 배포는 차기 |
| 사용자 요청 모호 | 자체 추론 금지. `AskUserQuestion`으로 2~4지선다 질의 |

## 팀 크기 가이드라인 적용

현재 범위는 **대규모 (20개+ 작업)** → 팀원 5명 권장. 현재 6명(qa 포함)은 경계선. qa를 Phase 4에서 서브 에이전트로 빼면 Phase 3 팀은 4명 유지 가능.

## Phase별 실행 모드 요약

| Phase | 모드 | 에이전트 수 |
|-------|------|------------|
| 0 (컨텍스트) | 리더 단독 | 0 |
| 1 (분석) | 리더 단독 | 0 |
| 2 (설계) | 서브 에이전트 | 1 (architect) |
| 3 (구현) | **에이전트 팀** | 4 (backend, ai, frontend, devops) |
| 4 (경계 QA) | 서브 에이전트 (경계별 반복) | 1 (qa) |
| **5.5 (PRR)** | **서브 에이전트 (라운드 반복)** | **1 (qa) + 수정 시 owner wake-up** |
| 5 (스모크) | 서브 에이전트 | 1 (devops) |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "MaKIT 하네스로 백엔드부터 배포까지 구축해줘"
2. Phase 0: `_workspace/` 없음 → 초기 실행
3. Phase 1: 리더가 범위 분석 → 3도메인 전체 + 배포
4. Phase 2: architect 서브 에이전트 → 설계 파일 3종 + ADR
5. Phase 3: 팀 생성 → 11개 Task 분배 → 병렬 구현
6. Phase 4: qa가 경계별 검증 → 버그 2개 발견 → 수정 → 재검증 통과
7. **Phase 5.5 (PRR)**: qa가 7 범주 감사 → BLOCKER 2 + MAJOR 5 발견 → owner들 수정 → 재라운드 → ALL CONFIRMED FIXED
8. Phase 5: `docker-compose up -d` 성공 → 스모크 8개 통과
9. 릴리스 리포트 + 운영 준비 리포트(`99b_operations_readiness_report.md`) 산출 + 사용자 피드백 요청

### 에러 흐름 1 (architect 산출물 이상)
1. Phase 2 후 architect의 API 계약에 필수 필드 누락
2. 리더가 Phase 2 재실행 — `architect`만 다시 호출 (이전 `_workspace/01_*`는 backup)
3. 정상화되면 Phase 3으로

### 에러 흐름 2 (Bedrock 접근 불가)
1. Phase 3에서 ai-engineer가 실제 Bedrock 호출 실패 (자격 증명 없음)
2. ai-engineer가 mock 구현체 + TODO 주석으로 진행
3. 릴리스 리포트에 "AWS 자격증명 설정 후 재배포 필요" 명시

### 에러 흐름 3 (사용자 중단)
1. Phase 3 진행 중 사용자 요구사항 변경
2. 리더가 `_workspace/` 보존 + 현재 Task 정리
3. 변경된 요구 반영한 새 Plan 제시 후 재진행

## Phase 선택 매트릭스 (후속 요청 시)

| 변경 유형 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|----------|---------|---------|---------|---------|---------|
| 새 엔드포인트 추가 | 건너뜀 | 계약 수정만 | backend(+ai 필요 시) | 해당 경계 | — |
| 프롬프트 개선 | 건너뜀 | 건너뜀 | ai만 | 경계 2 | — |
| 프론트 버그 수정 | 건너뜀 | 건너뜀 | frontend만 | 경계 1 | — |
| 새 도메인 추가 | 필수 | 필수 | 전체 팀 | 전체 경계 | 필수 |
| 배포 환경 변경 | 건너뜀 | 건너뜀 | devops만 | 경계 4 | 필수 |
| 아키텍처 변경 | 필수 | 필수 | 영향받는 에이전트 | 필수 | 필수 |

## 팀 해체 / 재구성

- Phase 3 완료 후 팀 해체 (산출물은 `_workspace/`에 보존)
- Phase 4 qa는 서브 에이전트로 실행 (팀 불필요)
- 후속 요청에서 Phase 3이 다시 필요하면 **새 팀 생성**

## 사용자 피드백 루프

Phase 5 완료 후 반드시 질의:

> "릴리스 리포트(`_workspace/99_release_report.md`)를 확인했을 때, 개선할 부분이 있나요? 구체적으로:
> 1. 에이전트 팀 구성 (현재 6명) 적절한가요?
> 2. 누락된 도메인/기능이 있나요?
> 3. 에러 처리/QA 깊이가 충분한가요?"

피드백 반영 경로:
- 결과물 품질 → 해당 에이전트 스킬 수정
- 팀 구성 문제 → 이 오케스트레이터 + 에이전트 정의 수정
- 트리거 누락 → 이 스킬 또는 관련 스킬의 description 확장

모든 변경은 `CLAUDE.md`의 **변경 이력** 테이블에 기록.

## 참조

- 에이전트 정의: `.claude/agents/{architect,backend-engineer,ai-engineer,frontend-engineer,devops-engineer,qa-engineer}.md`
- 도메인 스킬: `.claude/skills/{spring-boot-backend,bedrock-ai-integration,frontend-integration,docker-aws-deploy,integration-qa}/SKILL.md`
- 프로젝트 설계: `README.md` "설계 문서" 섹션
