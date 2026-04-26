# MaKIT 프로젝트 구조

> 2026-04-26 정리 — 어수선했던 `_workspace/`, `infra/`, `0. Design1_Mokup/`을 목적별 분류로 재구성.

## 한 페이지 요약

```
MaKIT/
├── README.md                  ← 사용자 빠른 시작
├── CLAUDE.md                  ← 하네스 가이드 + 변경 이력
├── package.json               ← E2E 테스트 의존성 (루트 Node 프로젝트)
├── playwright.config.ts       ← Playwright 설정
│
├── Docker 자산 (루트 유지 — 표준 컨벤션)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── docker-compose.override.yml
│   ├── nginx.conf
│   └── .dockerignore
│
├── backend/                   ← Spring Boot 3.2 + Java 21 (Maven)
├── frontend/                  ← 정적 자산 (HTML/CSS/Vanilla JS)
├── tests/                     ← Playwright E2E
│
├── deploy/                    ← 배포·인프라 통합 (NEW)
│   ├── terraform/             ← AWS IaC (이전 infra/terraform)
│   └── scripts/               ← 배포·운영 스크립트 (이전 scripts/)
│
├── docs/                      ← 모든 문서 통합 (이전 _workspace/)
│   ├── PROJECT_STRUCTURE.md   ← 본 문서
│   ├── architecture/          ← 시스템 설계·API 계약·데이터 모델
│   ├── design/                ← UX 토큰·컴포넌트 가이드
│   ├── rounds/                ← R 라운드 산출물 (R13~R16+)
│   ├── runbooks/              ← 운영 가이드 (E2E·CI·deploy)
│   └── agent-progress/        ← 옛 agent 진행 보고서 (이력 보존용)
│
├── _archive/                  ← 사용 안 하는 옛 자산 (NEW)
│   └── design-mockup-v0/      ← 초기 mockup (이전 "0. Design1_Mokup/")
│
└── 숨김 파일들
    ├── .git/
    ├── .github/               ← GitHub Actions (CI/CD, R16c)
    ├── .claude/               ← 하네스 정의 (agents/skills)
    ├── .gitignore, .env.example, .replit
```

## 디렉토리별 상세

### `backend/` — Spring Boot
- 표준 Maven 레이아웃 (`src/main/java/com/humanad/makit/...`)
- 도메인별 패키지: auth/, dashboard/, marketing/, commerce/, ai/, notification/, audit/, admin/, job/
- 60+ REST endpoints, 12+ Flyway migrations, JaCoCo coverage 활성화
- 실행: `cd backend && ./mvnw spring-boot:run`

### `frontend/` — Vanilla JS PWA
```
frontend/
├── *.html (11 페이지)         ← index/intro/login/all-services/service-detail/
│                                marketing-hub/settings/history/admin/components/404
├── css/                       ← D1 토큰 (tokens.css) + 페이지별 + app-shell + components-guide
├── js/
│   ├── api.js, auth.js, ui.js, config.js
│   ├── chatbot-widget.js, user-menu.js, modal.js
│   ├── i18n.js, i18n-dict.js (R16a)
│   ├── push-subscribe.js, sw-register.js (R13/R14c)
│   ├── skeleton.js (R15c)
│   ├── ws-client.js (R8 STOMP)
│   └── pages/*.js (페이지별 컨트롤러)
├── img/illustrations/         ← 10 SVG (D1 token 기반)
├── manifest.webmanifest       ← PWA 매니페스트
└── sw.js                      ← 서비스 워커 (offline + push)
```

**R22c: `components.html`** — Design system 완전 가이드
- 색상 팔레트 (brand/surface/text/status)
- 타이포그래피 스케일 (4xl~sm, weights)
- 스페이싱 & 라디우스 토큰 시각화
- 모션 & 애니메이션 (duration/easing) 인터랙티브 데모
- 라이브 컴포넌트 예제 (buttons/inputs/modal/notifications/badges/skeleton/stat-cards)
- 유틸리티 클래스 목록
- i18n & a11y 베이스라인 설명

### `tests/e2e/` — Playwright
- `auth.spec.ts` (production-ready, 6 테스트)
- `service.spec.ts`, `boundary.spec.ts` (skeleton)
- `README.md`, `IMPLEMENTATION_GUIDE.md`

### `deploy/` — 배포 자산 (통합)
- `terraform/` — 9 모듈 (vpc/ecs/rds/...) + envs/{dev,prod}.tfvars
- `scripts/` — bootstrap-tfstate, deploy-aws, push-to-github, setup (sh/ps1 페어)

### `docs/` — 문서 허브

| 폴더 | 용도 | 예시 |
|------|------|------|
| `architecture/` | 시스템 설계 | `01_architect_system_design.md`, `01_architect_api_contracts.md` |
| `design/` | UX/디자인 시스템 | `D1_Design_Tokens_Proposal.md`, `D2_Page_CSS_Token_Migration_Proposal.md` |
| `rounds/` | R 라운드 산출물 | `02_backend_R13_notification_triggers.md`, `04_frontend_R16a_i18n.md` |
| `runbooks/` | 운영 가이드 | `05_devops_runbook.md`, `06_qa_R16d_e2e_runbook.md` |
| `agent-progress/` | 옛 진행 보고서 | `02_backend_progress.md`, `06_qa_report_2026-04-20.md` |

### `_archive/` — 옛 자산 보존
- 빌드/배포에서 제외되는 휴면 자산
- 향후 참고용으로 보존 (삭제하지 않음)

### `features/` — 기능별 카탈로그 (NEW — R17)

기능 단일 진입점. 각 기능의 문서, 파일 경로, API 명세를 한곳에서 관리.

```
features/
├── _TEMPLATE/              ← 새 기능 생성 시 템플릿
├── INDEX.md                ← 전체 기능 목록 + 네비게이션
│
├── nlp-analyze/            ← 자연어 분석
├── youtube-comments/       ← 유튜브 댓글 분석
├── youtube-influence/      ← 유튜브 영향력 분석
├── youtube-keyword-search/ ← 유튜브 키워드 검색
├── url-analyze/            ← URL 콘텐츠 분석
│
├── feed-generate/          ← 인스타그램 피드 생성
├── remove-bg/              ← 배경 제거
├── modelshot/              ← 모델컷 생성
│
├── chatbot/                ← AI 챗봇
├── review-analysis/        ← 리뷰 분석
│
├── auth/                   ← 인증 시스템
├── marketing-hub/          ← 마케팅 대시보드
├── notifications/          ← 알림 시스템
├── push-notifications/     ← 웹 푸시
├── admin-dashboard/        ← 관리자 대시보드
├── i18n/                   ← 다국어
├── pwa/                    ← 프로그레시브 웹 앱
```

각 기능 폴더는 4개 파일 포함:
1. **README.md** — 기능 설명, 시나리오, 기술 스택
2. **manifest.json** — 파일 경로 매핑, 엔드포인트, 의존성
3. **api.md** — REST 명세 (요청/응답 예시)
4. **changelog.md** — R 라운드별 이력

신규 기능 생성 헬퍼:
```bash
./deploy/scripts/new-feature.sh my-feature  # Bash
.\deploy\scripts\new-feature.ps1 -Name my-feature  # PowerShell
```

자세한 사항: `features/INDEX.md`

## 변경 매핑 (이전 → 신규)

| 이전 위치 | 신규 위치 | 비고 |
|----------|----------|------|
| `0. Design1_Mokup/` | `_archive/design-mockup-v0/` | 폴더명 정상화 |
| `infra/terraform/` | `deploy/terraform/` | 배포 자산 통합 |
| `scripts/` | `deploy/scripts/` | 배포 자산 통합 |
| `_workspace/01_architect_*` | `docs/architecture/` | 분류 |
| `_workspace/design/*` | `docs/design/` | 분류 |
| `_workspace/*R[0-9]*.md` | `docs/rounds/` | 분류 |
| `_workspace/05_devops_runbook.md` | `docs/runbooks/` | 분류 |
| `_workspace/06_qa_R16d_e2e_runbook.md` | `docs/runbooks/` | 분류 |
| `_workspace/02-07_*progress*.md` 등 | `docs/agent-progress/` | 옛 보고서 |

## 참조 경로 업데이트 완료

- `.github/workflows/docker-publish.yml`: `infra/terraform` → `deploy/terraform`, `scripts/` → `deploy/scripts/`
- `README.md`: 동일 매핑
- `deploy/scripts/*.{sh,ps1}`: 자기 참조 정정
- `deploy/terraform/README.md`: 경로 정정

## 후속 정리 (사용자 머신에서 직접 실행)

샌드박스 권한 제약으로 빈 폴더(`_workspace/`, `infra/`) 자체는 삭제 불가. 사용자가 다음 명령으로 마무리:

```powershell
# PowerShell
cd "C:\I. Program\Workspace_\Make.IT_Ai-Assistant_platform-main\Make.IT_Ai-Assistant_platform-main"
Remove-Item _workspace -Recurse -Force
Remove-Item infra -Recurse -Force
git add -A
git commit -m "chore: 파일 구조 정리 - deploy/, docs/ 통합 + _archive/ 분리"
```

또는 bash:
```bash
rm -rf _workspace infra
git add -A
git commit -m "chore: 파일 구조 정리"
```

## 디자인 원칙

1. **목적이 디렉토리 이름** — `deploy`는 배포, `docs`는 문서, `_archive`는 보존
2. **숫자/특수문자 prefix 금지** — 알파벳 시작 (`0. Design1_Mokup` 같은 안티패턴 제거)
3. **루트는 핵심만** — 빌드 진입점, README, 표준 docker 파일만 노출
4. **휴면 자산은 underscore prefix** — `_archive/`로 시각적 구분
5. **참조 경로 일관성** — CI/문서/스크립트 모두 같은 경로 사용
