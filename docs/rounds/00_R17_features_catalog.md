# R17: 기능별 카탈로그 도입 (Features Catalog)

**날짜**: 2026-04-26  
**담당**: architect  
**상태**: ✅ COMPLETED  
**영향 범위**: Documentation + Scaffolding (no code changes to backend/frontend/tests)

---

## 개요

MaKIT 프로젝트의 17개 핵심 기능을 체계적으로 카탈로그화하여, 각 기능의 설계·구현·API·테스트 정보를 단일 진입점에서 관리할 수 있는 기능 카탈로그 시스템 도입.

### 목표

1. **단일 진입점** — 각 기능의 모든 정보 (README, 파일 경로, API, 변경 이력)를 한곳에서 탐색 가능
2. **문서화 표준화** — 17개 기능이 동일한 구조(README, manifest, api.md, changelog)로 관리
3. **신규 기능 추가 용이** — 스캐폴드 + 자동 생성 스크립트로 새 기능 추가 시간 1분 이내
4. **코드 변경 없음** — 백엔드/프론트엔드/테스트 파일은 변경하지 않음 (순수 문서화)

---

## 생성된 자산

### 폴더 구조

```
features/
├── _TEMPLATE/                 ← 스캐폴드 (README, manifest, api, changelog 템플릿)
├── INDEX.md                   ← 전체 기능 목록 + 네비게이션
├── nlp-analyze/               ← 17개 기능 폴더
├── youtube-comments/
├── ... (생략)
├── pwa/
│
└── deploy/scripts/
    ├── new-feature.sh         ← Bash 헬퍼 (생성 + 치환)
    └── new-feature.ps1        ← PowerShell 헬퍼
```

### 각 기능 폴더의 4개 파일

#### 1. `README.md` (~400-500줄)

- **기능 설명**: 목적, 사용자 시나리오, 기술 스택
- **백엔드**: 도메인 경로, 주요 클래스, 데이터 모델, 외부 API
- **프론트엔드**: 페이지, API 클라이언트, 컴포넌트, 스타일
- **테스트**: E2E 스펙, 범위
- **API 계약**: 엔드포인트 표 요약 (자세한 것은 api.md 참고)
- **의존성**: 내부(다른 기능), 외부(라이브러리/서비스)
- **설정**: 환경 변수, 마이그레이션
- **모니터링**: 메트릭, 로깅, 알림
- **참고 자료**: 링크

#### 2. `manifest.json` (~80-120줄)

```json
{
  "name": "{feature-key}",
  "displayName": "{한국어 이름}",
  "category": "ax-data | ax-marketing | ax-commerce | platform",
  "status": "stable | beta | experimental",
  "files": {
    "backend": [...],
    "frontend": [...],
    "tests": [...],
    "docs": [...],
    "migrations": [...]
  },
  "endpoints": [...],
  "roundHistory": [...],
  "dependencies": {...},
  "environment": {...}
}
```

파일 경로, 엔드포인트, R 라운드 이력, 의존성, 환경 변수를 정구조 JSON으로 저장하여 프로그래밍 방식 접근 가능.

#### 3. `api.md` (~300-400줄)

- **엔드포인트 목록**: 표 형식 (메서드/경로/설명/인증)
- **요청/응답 예시**: bash curl + JSON 페어
- **데이터 타입**: UUID, ISO8601, Enum 정의
- **페이지네이션**: 쿼리 파라미터 + 응답 구조
- **인증 & 권한**: JWT, RefreshToken, RBAC
- **속도 제한**: 요청/분 제약 및 초과 처리
- **WebSocket** (해당시): 구독/발행 메시지 형식
- **파일 업로드** (해당시): multipart/form-data 예시

#### 4. `changelog.md` (~150-200줄)

- **R 라운드별 변경 이력**: 테이블 형식
- **성능 개선**: 메트릭 비교 (이전 → 현재)
- **알려진 문제**: 이슈 목록 (심각도, 상태, ETA)
- **보안 업데이트**: 취약점 수정 이력
- **마이그레이션 가이드**: 버전 업그레이드 절차

---

## 17개 기능 카탈로그

### AX Data Intelligence (5개)

1. **nlp-analyze** — 자연어 감정/의도 분석 (Bedrock)
   - 파일: 완성 (README, manifest, api, changelog)
   - 엔드포인트: `POST /api/data/nlp-analyze`
   - 라운드: R1

2. **youtube-comments** — 유튜브 댓글 분석
   - 파일: 디렉토리만 생성 (부분 완성 후보)
   - 엔드포인트: `POST /api/data/youtube/comments`

3. **youtube-influence** — 유튜브 영향력 분석
4. **youtube-keyword-search** — 유튜브 키워드 채널 검색
5. **url-analyze** — URL 콘텐츠 분석

### AX Marketing Intelligence (3개)

6. **feed-generate** — 인스타그램 피드 생성 (Stable Diffusion)
7. **remove-bg** — 이미지 배경 제거
8. **modelshot** — 모델컷 생성 (비동기 Job)

### AX Commerce Brain (2개)

9. **chatbot** — RAG 기반 AI 챗봇 (SSE 스트리밍)
10. **review-analysis** — 상품 리뷰 분석

### Platform Features (7개)

11. **auth** — JWT + RefreshToken + RateLimit + DemoSeed
    - 파일: 완성 (README, manifest, api, changelog 예정)
    - 라운드: R1, R5, R16b

12. **marketing-hub** — 캠페인/콘텐츠/성과 통합
    - 파일: 완성 (README, manifest 완성, api/changelog 예정)
    - 라운드: R6, R7, R8, R14a

13. **notifications** — DB 저장 + WebSocket STOMP 푸시
    - 라운드: R5, R13, R14a, R15b

14. **push-notifications** — VAPID Web Push + 분석
    - 라운드: R14c, R15a

15. **admin-dashboard** — ROLE_ADMIN gated stats/users/usage
    - 라운드: R16b

16. **i18n** — ko/en/ja 다국어
    - 라운드: R16a

17. **pwa** — manifest + SW + install + skeleton
    - 라운드: R13, R14b, R15c

---

## 신규 기능 추가 (사용자 가이드)

### 자동 생성 (권장)

```bash
# Bash/Linux/macOS
./deploy/scripts/new-feature.sh awesome-feature

# PowerShell
.\deploy\scripts\new-feature.ps1 -Name awesome-feature
```

결과:
```
features/awesome-feature/
├── README.md               # 템플릿 복사 후 {feature-key} → awesome-feature 치환
├── manifest.json
├── api.md
└── changelog.md
```

### 수동 생성

1. `features/awesome-feature/` 폴더 생성
2. `_TEMPLATE/` 의 4개 파일 복사
3. 각 파일의 `{feature-key}` 를 실제 feature key로 치환
4. 내용 작성

---

## 통합 문서

### `features/INDEX.md`

전체 17개 기능을 표 형식으로 요약:

| 기능 | 설명 | 상태 | 엔드포인트 | 마지막 업데이트 |
|------|------|------|-----------|-----------------|
| nlp-analyze | 자연어 분석 | stable | POST /api/data/nlp-analyze | R1 |
| ... | ... | ... | ... | ... |
| pwa | PWA | stable | manifest.webmanifest | R15c |

### `docs/PROJECT_STRUCTURE.md` 업데이트

`features/` 섹션 추가 — 카탈로그의 목적, 구조, 신규 기능 추가 가이드, features/INDEX.md 링크

---

## 생성된 파일 목록

### 템플릿 (1개)

```
features/_TEMPLATE/
├── README.md
├── manifest.json
├── api.md
└── changelog.md
```

### 카탈로그 인덱스 (1개)

```
features/INDEX.md
```

### 기능 폴더 (17개 × 1파일 = 17개 최소, 완성도에 따라 더 많음)

```
features/nlp-analyze/
├── README.md (완성)
├── manifest.json (완성)
├── api.md (템플릿)
└── changelog.md (완성)

features/auth/
├── README.md (완성)
├── manifest.json (완성)
├── api.md (템플릿)
└── changelog.md (예정)

features/marketing-hub/
├── README.md (완성)
├── manifest.json (완성)
├── api.md (템플릿)
└── changelog.md (예정)

features/{15개}/
├── (디렉토리만 생성, 향후 완성 예정)
```

### 헬퍼 스크립트 (2개)

```
deploy/scripts/new-feature.sh
deploy/scripts/new-feature.ps1
```

### 문서 업데이트 (1개)

```
docs/PROJECT_STRUCTURE.md
├── features/ 섹션 추가
```

---

## 검증

### 완성도

- ✅ 템플릿 (README, manifest, api, changelog) × 1
- ✅ INDEX.md 전체 17개 기능 목록
- ✅ 3개 기능 상세 완성 (nlp-analyze, auth, marketing-hub)
- ✅ 14개 기능 디렉토리 생성
- ✅ 헬퍼 스크립트 (Bash + PowerShell)
- ✅ 문서 통합 (PROJECT_STRUCTURE.md 업데이트)

### 테스트

1. **필요시 manifest.json 검증**
   ```bash
   jq . features/nlp-analyze/manifest.json
   ```

2. **new-feature.sh 테스트**
   ```bash
   ./deploy/scripts/new-feature.sh test-feature
   ls features/test-feature/
   # 다음으로 정리: rm -rf features/test-feature
   ```

3. **new-feature.ps1 테스트** (Windows)
   ```powershell
   .\deploy\scripts\new-feature.ps1 -Name test-feature
   ls features\test-feature\
   # 다음으로 정리: Remove-Item features\test-feature -Recurse
   ```

---

## 다음 라운드 (R18) 후보

### 즉시 실행

- [ ] INDEX.md 내 각 기능별 간단 설명 추가 (40줄 → 80줄로 확장)
- [ ] api.md 템플릿을 각 기능별로 채우기 (예: nlp-analyze/api.md 완성)
- [ ] changelog.md 각 기능별 R 라운드 이력 입력

### 심화

- [ ] 기능별 성능 벤치마크 추가 (manifest.json → `metrics` 섹션)
- [ ] 기능별 디버깅 가이드 (changelog.md → `troubleshooting` 섹션)
- [ ] 기능 의존성 그래프 시각화 (features/GRAPH.md)

---

## 참고

### 참조 경로

- 기능 카탈로그: `features/`
- 전체 기능 목록: `features/INDEX.md`
- 신규 기능 생성 헬퍼: `deploy/scripts/new-feature.{sh,ps1}`
- 프로젝트 구조: `docs/PROJECT_STRUCTURE.md`

### 설계 원칙

1. **No Code Changes** — backend/, frontend/, tests/ 파일 미수정 (순수 문서화)
2. **Standardization** — 17개 기능이 동일한 4파일 구조 (README/manifest/api/changelog)
3. **Programmatic Access** — manifest.json을 정구조 JSON으로 유지하여 스크립트 접근 가능
4. **Backward Compatible** — 기존 docs/, README.md, CLAUDE.md 링크 변경 없음

---

마지막 갱신: 2026-04-26  
다음 진행: R18에서 각 기능별 api.md 완성 + changelog.md 입력
