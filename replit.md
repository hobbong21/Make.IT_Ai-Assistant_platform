# MaKIT - AX Marketing Platform

## Project Overview
MaKIT is an AI-driven marketing automation platform by Human.Ai.D. It provides three core domains:
- **AX Data Intelligence**: NLP data analysis, YouTube comment analysis, website content extraction
- **AX Marketing Intelligence**: AI content generation (Instagram feeds/captions), image background removal
- **AX Commerce Brain**: RAG-based customer support chatbots, product review sentiment analysis, AI modelshot images

## Architecture
- **Frontend**: Vanilla JavaScript (ES6), HTML5/CSS3 static site served via Node.js on port 5000
- **Backend** (not running locally): Spring Boot 3.2.0 + Java 21, expected on `localhost:8083`
- **AI Stack**: Amazon Bedrock (Claude 3, Stable Diffusion, Titan embeddings)
- **Database**: PostgreSQL with pgvector extension (via Docker/AWS in production)
- **Cache**: Redis
- **Infrastructure**: Terraform on AWS (ECS, RDS, S3, ElastiCache)

## Local Development Setup
The frontend is served as a static site using a simple Node.js HTTP server (`serve.js`) on port 5000.

### Workflow
- **Start application**: `node serve.js` → serves `frontend/` on port 5000

### Entry flow (2026-05-07)
- Root `/` → `intro.html` (public landing)
- `index.html`(플랫폼 홈) requires login — `js/pages/index.js` calls `auth.requireLogin()`, which redirects to `login.html` if no token
- `login.html` 성공 후 `index.html`로 이동
- 알 수 없는 경로(404 fallback)도 `intro.html`로 (퍼블릭)

### API Configuration
The frontend (`frontend/js/config.js`) auto-detects the environment:
- Served via same-origin: uses `/api` (expects Nginx proxy to backend)
- Served directly: uses `http://localhost:8083/api`

The full backend (Spring Boot) requires:
- Java 21
- PostgreSQL with pgvector
- Redis
- AWS credentials for Bedrock, S3, Cognito

## Project Structure (업무 단위 정리, 2026-05-06)
```
├── frontend/                # Static web app
│   ├── *.html               # All pages at root (URL 안정성 위해 평면 유지)
│   ├── css/
│   │   ├── core/            # tokens, common, app-shell, components-guide (전 페이지 공통)
│   │   └── pages/           # styles(index), intro, all-services, service-detail, marketing-playbooks, marketing-hub, admin
│   ├── js/
│   │   ├── core/            # api, config, auth, i18n(+dict), ui, modal, sw-register, push-subscribe, ws-client
│   │   ├── widgets/         # app-shell-extras, user-menu, skeleton, chatbot-widget
│   │   └── pages/           # 페이지별 엔트리 스크립트 (기존 그대로)
│   ├── img/, sw.js, manifest.webmanifest
├── backend/                 # Spring Boot (src/, pom.xml)
├── infra/                   # Terraform IaC for AWS
├── docs/                    # Architecture documentation
├── scripts/                 # Deployment & setup scripts
├── archive/                 # 더 이상 활성 사용하지 않는 자료
│   ├── Design1_Mockup_legacy/   # 구 디자인 목업 (구: "0. Design1_Mokup")
│   └── _workspace/              # 구 작업 산출물/리포트
├── docker-compose.yml, nginx.conf, Dockerfile
└── serve.js                 # Replit용 Node.js 정적 서버
```
파일 이동 시 갱신된 곳: 모든 `frontend/*.html`의 `<link>/<script>` 경로, `frontend/sw.js` precache 목록.

## Design system (Claude UI inspired, 2026-05-06)
- `tokens.css` D2: warm cream (#faf9f5), Claude coral accent (#c96442), warm-dark sidebar tokens (`--mk-color-sidebar-*`), more rounded radii (md=12, lg=16, xl=24). Light + warm-dark theme pair (auto + `[data-theme]`).
- `index.html` 재설계: 인사 헤딩 + 챗 입력 모형(`.chat-mock`) + quick-action 칩 + 컴팩트 stats + activity + 서비스 카드 (Claude.ai 홈 레이아웃 모티브). 사이드바는 다크.
- `styles.css` 전체 교체 (index 전용). 다른 페이지는 토큰 변경분만 자동 반영.

## Marketing Playbooks (additive feature)
- Pages: `marketing-playbooks.html` (list), `marketing-playbook.html` (detail)
- Scripts: `frontend/js/pages/marketing-playbooks.js`, `frontend/js/pages/marketing-playbook.js`
- Style: `frontend/css/marketing-playbooks.css`
- Source: live fetch from `raw.githubusercontent.com/coreyhaines31/marketingskills/main` (MIT). 41 skills, 7 categories, search/favorites/version-bump notice. Markdown rendered via `marked` CDN. Cached in sessionStorage (30 min). Linked from AX Marketing Intelligence dropdown in `index.html`, `all-services.html`, `service-detail.html`.

## Deployment
- Configured as a static site deployment serving the `frontend/` directory
- In production with backend: uses Docker Compose with Nginx proxying to Spring Boot

## User preferences
- **Coding guidelines**: Follow `CLAUDE.md` strictly for all development work. Four principles: (1) Think Before Coding — surface assumptions, ask when ambiguous; (2) Simplicity First — minimum code, no speculative features; (3) Surgical Changes — only touch what's required by the request; (4) Goal-Driven Execution — define verifiable success criteria before implementing.
