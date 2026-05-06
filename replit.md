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

### API Configuration
The frontend (`frontend/js/config.js`) auto-detects the environment:
- Served via same-origin: uses `/api` (expects Nginx proxy to backend)
- Served directly: uses `http://localhost:8083/api`

The full backend (Spring Boot) requires:
- Java 21
- PostgreSQL with pgvector
- Redis
- AWS credentials for Bedrock, S3, Cognito

## Project Structure
```
├── frontend/          # Static web app (HTML/CSS/JS)
│   ├── css/           # Stylesheets
│   ├── js/            # API client, auth, page scripts
│   └── *.html         # Pages (index, login, intro, all-services, service-detail)
├── backend/           # Spring Boot application (src/, pom.xml)
├── infra/             # Terraform IaC for AWS
├── docs/              # Architecture documentation
├── scripts/           # Deployment & setup scripts
├── docker-compose.yml # Full local stack orchestration
├── nginx.conf         # Nginx reverse proxy config (Docker)
└── serve.js           # Simple Node.js static file server for Replit
```

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
