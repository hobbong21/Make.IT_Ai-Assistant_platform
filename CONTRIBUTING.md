# MaKIT 기여 가이드

> Welcome! 외부 기여자가 MaKIT 프로젝트에 빠르게 합류할 수 있도록 안내합니다.

## TL;DR (5분 시작)

```bash
# 1. Clone
git clone https://github.com/hobbong21/Make.IT_Ai-Assistant_platform.git
cd Make.IT_Ai-Assistant_platform

# 2. 백엔드 실행 (Java 21 + PostgreSQL pgvector 필요)
docker-compose up -d postgres
cd backend && ./mvnw spring-boot:run

# 3. 프론트엔드 (다른 터미널)
docker-compose up -d nginx   # 또는 python -m http.server 8081 (frontend/ 안에서)

# 4. 접속
open http://localhost:8080  # 데모 계정: demo@makit.local / Demo!1234
```

## 프로젝트 개요

**MaKIT** = Make.IT AX 마케팅 플랫폼. AI 기반 마케팅 자동화 (10개 핵심 서비스 + 7개 플랫폼 기능).

| 영역 | 기술 | 위치 |
|------|------|------|
| Backend | Spring Boot 3.2 + Java 21 + PostgreSQL pgvector | `backend/` |
| Frontend | Vanilla JS + HTML/CSS (D1 디자인 토큰) | `frontend/` |
| AI | AWS Bedrock (Claude/Titan) + RAG | `backend/.../ai/` |
| Tests | Playwright E2E | `tests/e2e/` |
| Deploy | Docker + AWS ECS + Terraform | `deploy/` |
| Docs | docs/ + features/ 카탈로그 | 본 문서 참조 |

## 사전 요구사항

| 도구 | 최소 버전 | 설치 |
|------|----------|------|
| Java | 21 | https://adoptium.net/ |
| Maven | 3.9+ | (또는 mvnw 사용) |
| Node.js | 20+ | https://nodejs.org/ (E2E 테스트용) |
| Docker | 24+ | https://www.docker.com/ |
| Git | 2.40+ | https://git-scm.com/ |

선택:
- AWS CLI + Bedrock 권한 (실 AI 호출용 — 없으면 stub fallback)
- Playwright 브라우저 (`npx playwright install`)

## 개발 워크플로우

### 1. Issue 또는 Discussion 먼저
새 기능/버그는 GitHub Issues에서 논의 후 시작. 중복 작업 방지.

### 2. 브랜치 컨벤션
- `feat/<feature-name>` — 새 기능
- `fix/<short-description>` — 버그 수정
- `docs/<area>` — 문서만
- `chore/<description>` — 인프라/리팩토링

### 3. 코드 작성

**백엔드 (Java)**:
- 도메인 패키지: `com.humanad.makit.<domain>` (auth, marketing, commerce, ai, notification, audit, admin, job)
- 컨트롤러는 `@RestController` + `@RequestMapping("/api/<domain>")`
- 비즈니스 로직은 Service에, DTO는 record로
- 모든 endpoint에 `@Auditable(resource="...", action="...")` 적용 → 자동 audit log + Prometheus 메트릭
- DB 변경은 Flyway 마이그레이션으로 (`backend/src/main/resources/db/migration/V<timestamp>__<name>.sql`)

**프론트엔드 (Vanilla JS)**:
- D1 디자인 토큰 사용 (`var(--mk-color-*)`, `var(--mk-space-*)`, `var(--mk-radius-*)`)
- 페이지 컨트롤러: `frontend/js/pages/<page>.js`
- 공유 유틸: `frontend/js/{api,auth,ui,modal,...}.js`
- 한국어 텍스트는 `data-i18n="<key>"` 속성으로 번역 가능하게 (`frontend/js/i18n-dict.js`에 추가)
- 새 HTML 추가 시 PWA 메타 + skip-link + ARIA 적용

### 4. 새 기능 추가 시 features/ 카탈로그 업데이트

**중요**: 새 기능을 만들 때 반드시 `features/<name>/` 폴더 생성:

```bash
# 자동 스캐폴드
./deploy/scripts/new-feature.sh my-new-feature

# features/my-new-feature/ 안에 4 파일 생성됨:
#   README.md, manifest.json, api.md, changelog.md
```

`manifest.json` 작성:
```json
{
  "name": "my-new-feature",
  "displayName": "내 새 기능",
  "category": "ax-data | ax-marketing | ax-commerce | platform",
  "owners": ["@your-github-username"],
  "status": "experimental",
  "files": {
    "backend": ["backend/src/main/java/com/humanad/makit/<path>/Controller.java"],
    "frontend": ["frontend/js/pages/my-new-feature.js"],
    "tests": ["tests/e2e/my-new-feature.spec.ts"]
  },
  "endpoints": ["POST /api/<path>"]
}
```

검증:
```bash
bash deploy/scripts/validate-features.sh
# CI에서 자동으로 실행됨 (.github/workflows/feature-catalog-check.yml)
```

자세한 사항: [features/CONTRIBUTING-CATALOG.md](features/CONTRIBUTING-CATALOG.md)

### 5. 테스트

**백엔드 단위/통합 테스트**:
```bash
cd backend
./mvnw test                        # 전체
./mvnw test -Dtest=AuthServiceTest # 단일
```
JaCoCo 커버리지 리포트: `backend/target/site/jacoco/index.html` (목표 70%)

**E2E 테스트**:
```bash
# 사전: 백엔드 + 프론트 정적 서버 실행 중
npm install
npx playwright install chromium
npx playwright test
```

자세한 가이드: [docs/runbooks/06_qa_R16d_e2e_runbook.md](docs/runbooks/06_qa_R16d_e2e_runbook.md)

### 6. PR 제출

체크리스트:
- [ ] 관련 features/<name>/ 업데이트 (manifest.json + changelog.md)
- [ ] `bash deploy/scripts/validate-features.sh` PASS
- [ ] 백엔드 변경 시: `./mvnw test` PASS
- [ ] 프론트 변경 시: 9 HTML body/html 닫는 태그 무결성 확인
- [ ] CLAUDE.md 변경 이력 추가 (Major changes only)
- [ ] PR 제목: `[feat|fix|docs|chore](<scope>): <summary>`
- [ ] PR 설명: 무엇을/왜/어떻게 + 스크린샷(UI 변경 시) + 테스트 방법

## 코딩 스타일

**Java**:
- Lombok `@RequiredArgsConstructor`, `@Slf4j` 권장
- DTO는 record로 (`public record FooDto(String name, int count) {}`)
- 비즈니스 예외는 `@RestControllerAdvice GlobalExceptionHandler`에서 처리
- Korean 메시지 (사용자 노출용)는 한국어, log/주석은 자유 (한국어 권장)

**JavaScript**:
- Vanilla ES6+ (No React/Vue/jQuery)
- IIFE 패턴 또는 단순 함수
- `window.makit*` 네임스페이스로 글로벌 노출
- localStorage 키 prefix: `makit_`
- 한국어 사용자 메시지

**CSS**:
- D1 토큰만 사용 (hardcoded 색/spacing 금지)
- `mk-` 클래스 prefix
- 다크모드 자동 지원 (`@media (prefers-color-scheme: dark)`)
- 모바일 퍼스트 + 3 브레이크포인트 (sm/md/lg)

## Architecture 의사결정

큰 변경(새 도메인 추가, 라이브러리 변경, DB 스키마 변경)은:
1. GitHub Discussion에서 논의
2. ADR(Architecture Decision Record) 작성 → `docs/architecture/01_architect_adr/`
3. 승인 후 구현

기능 의존성: [features/DEPENDENCY_GRAPH.md](features/DEPENDENCY_GRAPH.md) 참고

## 통신 채널

- **GitHub Issues** — 버그/기능 요청
- **GitHub Discussions** — 설계 논의/질문
- **GitHub PR Reviews** — 코드 리뷰
- **CLAUDE.md** — AI 에이전트(Claude Code)용 가이드 + 변경 이력

## 라이선스 + CLA

본 프로젝트는 [LICENSE](LICENSE) 참조 (TODO: license 파일 추가). 외부 기여 시 컨트리뷰터 라이선스 동의(CLA) 절차가 있을 수 있습니다.

## 행동 강령

존중·포용·건설적 피드백. [Contributor Covenant](https://www.contributor-covenant.org/) 준수.

## 도움이 필요할 때

1. 본 문서 + [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) 먼저 읽기
2. 기능별 진입점: `features/<name>/README.md`
3. 운영/배포: `docs/runbooks/`
4. 문서에 없으면 GitHub Discussion에 질문

## 자주 묻는 질문

**Q. 백엔드 디렉토리 구조 바꿔도 되나요?**
A. Spring Boot Maven 제약 + 60+ 참조 경로 때문에 큰 변경은 사전 ADR 필요. 작은 도메인 추가는 OK.

**Q. 새 npm 패키지 추가해도 되나요?**
A. 프론트엔드는 vanilla JS 정책 (CDN script만). E2E 테스트는 package.json에 추가 가능.

**Q. AWS Bedrock 자격증명 없이 개발할 수 있나요?**
A. 네. BedrockChatbotEngine은 자격증명 없으면 자동으로 stub fallback. 개발에는 충분.

**Q. PostgreSQL pgvector를 어떻게 설치하나요?**
A. `docker-compose up -d postgres` 가장 쉬움. 직접 설치 시: `psql -c "CREATE EXTENSION vector;"`

**Q. 새 R 라운드를 시작하려면?**
A. 작은 변경: 직접 PR. 큰 변경: GitHub Issue → 합의 → 구현. CLAUDE.md "변경 이력" 참고.

---

**환영합니다!** 첫 PR을 기다리겠습니다.
