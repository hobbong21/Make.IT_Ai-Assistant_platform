# R16d — E2E 테스트 실행 런북 (사용자 머신용)

이 문서는 R15d에서 작성된 Playwright E2E 테스트를 **사용자 머신에서 직접 실행**하는 단계별 가이드입니다.
샌드박스 환경에는 브라우저 런타임이 없으므로 실제 실행은 사용자가 수행해야 합니다.

## 사전 요구사항

| 도구 | 최소 버전 | 확인 명령 | 설치 가이드 |
|------|----------|----------|------------|
| Node.js | 18+ | `node -v` | https://nodejs.org/ |
| npm | 9+ | `npm -v` | Node 설치에 포함 |
| Java | 21 | `java -version` | https://adoptium.net/ |
| Maven | 3.9+ | `mvn -v` | https://maven.apache.org/ |
| PostgreSQL | 16 + pgvector | `psql --version` | Docker 권장 |
| Docker | 24+ | `docker -v` | https://www.docker.com/ |

## 1단계 — 백엔드 시작

### 옵션 A: docker-compose (권장)

```bash
cd C:\I. Program\Workspace_\Make.IT_Ai-Assistant_platform-main\Make.IT_Ai-Assistant_platform-main
docker-compose up -d postgres
# Postgres가 5432에서 healthy 될 때까지 대기 (15~30초)
docker-compose ps
```

### 옵션 B: 로컬 PostgreSQL

```bash
# pgvector 확장 설치
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
# DB 생성
psql -U postgres -c "CREATE DATABASE makit;"
```

### 백엔드 실행

```powershell
# PowerShell
$env:DB_URL = "jdbc:postgresql://localhost:5432/makit"
$env:DB_USER = "postgres"
$env:DB_PASSWORD = "postgres"
$env:JWT_SECRET = "test-secret-min-256-bits-long-for-development-only-not-prod"
$env:BEDROCK_REGION = "us-east-1"
# Bedrock 키 미설정 → stub fallback으로 자동 동작 (E2E엔 충분)

cd backend
.\mvnw.cmd spring-boot:run
```

백엔드가 `http://localhost:8080`에서 LISTEN 시작하면 다음 단계로 진행.

확인:
```bash
curl http://localhost:8080/actuator/health
# 응답: {"status":"UP"}
```

## 2단계 — 데모 사용자 시드 확인

DemoUserSeeder가 첫 실행 시 자동으로 demo 계정을 생성합니다:
- Email: `demo@makit.local`
- Password: `Demo!1234`

확인:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@makit.local","password":"Demo!1234"}'
# 응답: { "token":"eyJ..." , ... }
```

## 3단계 — Playwright 설치 (최초 1회)

프로젝트 루트(MaKIT 루트)에서:

```bash
npm install
# package.json의 @playwright/test가 설치됨 (R16c 산출물)

npx playwright install chromium
# Chromium 브라우저 다운로드 (~150MB)

# 옵션: 전체 브라우저 (Firefox + WebKit + Chromium)
npx playwright install
```

## 4단계 — 정적 파일 서빙

프론트엔드는 정적 파일이라 별도 서버 필요. 3가지 옵션:

### 옵션 A: 백엔드 nginx (docker-compose)
이미 docker-compose.yml에서 nginx가 `frontend/`를 80에 서빙합니다:
```bash
docker-compose up -d nginx
# http://localhost (또는 nginx 설정 포트)
```

### 옵션 B: Python 간이 서버
```bash
cd frontend
python -m http.server 8081
# http://localhost:8081
```

### 옵션 C: npx serve (Node)
```bash
npx serve frontend -p 8081
```

## 5단계 — Playwright 실행

`MAKIT_BASE_URL` 환경변수를 위 정적 서버 주소로 설정:

```powershell
# PowerShell
$env:MAKIT_BASE_URL = "http://localhost:8081"  # 옵션 B/C
# 또는
$env:MAKIT_BASE_URL = "http://localhost"  # 옵션 A (nginx)

# 모든 테스트 실행
npx playwright test

# 특정 spec만
npx playwright test auth.spec.ts

# UI 모드 (인터랙티브)
npx playwright test --ui

# 디버그 모드 (브레이크포인트)
$env:PWDEBUG = 1; npx playwright test auth.spec.ts
```

## 6단계 — 결과 확인

### HTML 리포트
```bash
npx playwright show-report
# 브라우저에서 http://localhost:9323 자동 오픈
```

### 트레이스 (실패 시 자동 수집)
```bash
npx playwright show-trace test-results\trace.zip
# 시간 기반 인터랙티브 디버거
```

### 스크린샷
실패한 테스트의 스크린샷은 `test-results/<test-name>/test-failed-1.png`에 저장.

## 7단계 — 일반적 문제 해결

### Q1. "ECONNREFUSED localhost:8080"
A. 백엔드가 시작되지 않음. 1단계 다시 확인. `curl /actuator/health` 응답 확인.

### Q2. "Cannot find module '@playwright/test'"
A. `npm install` 누락. 프로젝트 루트에서 다시 실행.

### Q3. "Browser not found"
A. `npx playwright install chromium` 실행.

### Q4. Auth spec 실패: "Cannot find #regBtn"
A. 프론트엔드 정적 서버 미실행. 4단계 옵션 중 하나 실행.

### Q5. "DB extension vector not found"
A. PostgreSQL에 pgvector 미설치. `psql -c "CREATE EXTENSION vector;"` 실행하거나 docker-compose가 `pgvector/pgvector:pg16` 이미지 사용 확인.

### Q6. Korean characters 깨짐
A. 터미널 인코딩 UTF-8 확인. PowerShell: `chcp 65001`.

## 8단계 — CI에서 동일 실행

R16c의 GitHub Actions `e2e-test` job은 위 단계를 모두 자동화합니다:
1. PostgreSQL 16+pgvector 컨테이너 spin up
2. Java 21 setup
3. Maven 빌드 + JAR 실행 (background)
4. /actuator/health curl 폴링
5. Node 20 setup + Playwright install
6. `npx playwright test`
7. 실패 시 HTML 리포트 + 트레이스 artifact 업로드

main 브랜치 push 또는 GitHub UI에서 manual workflow_dispatch로 트리거.

## 8단계 (Bonus) — 추가 시나리오 확장

R15d의 service.spec.ts와 boundary.spec.ts는 skeleton 상태입니다. 이를 실제 시나리오로 채우려면:

1. `tests/e2e/IMPLEMENTATION_GUIDE.md` 참조
2. 각 spec의 TODO 주석 해소
3. 실제 selector를 frontend HTML에서 추출 (login.html 패턴 참조)
4. fixture 함수로 로그인 + 데모 데이터 생성 추상화

## 검증 체크리스트

실행 전 확인:
- [ ] PostgreSQL pgvector 작동 (`psql -c "SELECT '[1,2,3]'::vector"`)
- [ ] 백엔드 health UP (`curl /actuator/health` → 200)
- [ ] 데모 로그인 성공 (`POST /api/auth/login`)
- [ ] 프론트엔드 정적 서버 응답 (`curl /index.html` → 200)
- [ ] `npx playwright --version` → 1.45+
- [ ] `MAKIT_BASE_URL` 환경변수 설정됨

실행 후 확인:
- [ ] auth.spec.ts 6개 테스트 PASS (등록/로그인/로그아웃/중복/비밀번호불일치/잘못된자격)
- [ ] HTML 리포트 생성
- [ ] 실패 시 trace.zip 존재

## 참고 문서

- Playwright 공식: https://playwright.dev/
- R15d 시나리오 문서: `_workspace/06_qa_r15d_e2e_scenarios.md`
- R16c CI 문서: `.github/CI.md`
- 테스트 README: `tests/e2e/README.md`
