# MaKIT 기능 카탈로그

> 기능별 단일 진입점. 각 기능의 설계, 구현, API, 테스트 정보를 한곳에서 찾을 수 있습니다.

## 빠른 참조

📊 **[기능 의존성 그래프](DEPENDENCY_GRAPH.md)** — 21개 기능의 상호 의존성 시각화 (계층도, SVG, 분석)

## 개요

MaKIT은 17개의 핵심 기능으로 구성되어 있으며, 각 기능은 독립적인 폴더 구조로 관리됩니다:

```
features/
├── _TEMPLATE/          ← 스캐폴드 (새 기능 추가 시 템플릿)
├── INDEX.md            ← 본 문서
├── DEPENDENCY_GRAPH.md ← 기능 간 의존성 (NEW)
├── dependencies.json   ← 의존성 머신 리더블 형식 (NEW)
├── dependency-graph.svg ← SVG 시각화 (NEW)
├── new-feature.sh      ← 기능 생성 헬퍼 스크립트
│
├── AX Data Intelligence (5개)
│   ├── nlp-analyze/
│   ├── youtube-comments/
│   ├── youtube-influence/
│   ├── youtube-keyword-search/
│   └── url-analyze/
│
├── AX Marketing Intelligence (3개)
│   ├── feed-generate/
│   ├── remove-bg/
│   └── modelshot/
│
├── AX Commerce Brain (2개)
│   ├── chatbot/
│   └── review-analysis/
│
└── Platform Features (7개)
    ├── auth/
    ├── marketing-hub/
    ├── notifications/
    ├── push-notifications/
    ├── admin-dashboard/
    ├── i18n/
    └── pwa/
```

## 기능 목록

### AX Data Intelligence — 데이터 분석 플랫폼

| 기능 | 설명 | 상태 | 엔드포인트 | 마지막 업데이트 |
|------|------|------|-----------|-----------------|
| [nlp-analyze](./nlp-analyze/) | 자연어 감정/의도 분석 (Bedrock) | stable | `POST /api/data/nlp-analyze` | R1 |
| [youtube-comments](./youtube-comments/) | 유튜브 댓글 분석 | stable | `POST /api/data/youtube/comments` | R1 |
| [youtube-influence](./youtube-influence/) | 유튜브 크리에이터 영향력 분석 | stable | `POST /api/data/youtube/influence` | R1 |
| [youtube-keyword-search](./youtube-keyword-search/) | 유튜브 키워드 채널 검색 | stable | `POST /api/data/youtube/keyword-search` | R1 |
| [url-analyze](./url-analyze/) | URL 메타데이터/콘텐츠 분석 | stable | `POST /api/data/url-analyze` | R1 |

### AX Marketing Intelligence — 콘텐츠 생성 플랫폼

| 기능 | 설명 | 상태 | 엔드포인트 | 마지막 업데이트 |
|------|------|------|-----------|-----------------|
| [feed-generate](./feed-generate/) | 인스타그램 피드 생성 (Stable Diffusion) | stable | `POST /api/marketing/feed-generate` | R1 |
| [remove-bg](./remove-bg/) | 이미지 배경 제거 (remove.bg API) | stable | `POST /api/marketing/remove-bg` | R1 |
| [modelshot](./modelshot/) | AI 모델컷 생성 (비동기 Job) | stable | `POST /api/commerce/modelshot` | R1 |

### AX Commerce Brain — 고객 상호작용 AI

| 기능 | 설명 | 상태 | 엔드포인트 | 마지막 업데이트 |
|------|------|------|-----------|-----------------|
| [chatbot](./chatbot/) | RAG 기반 AI 챗봇 (SSE 스트리밍) | stable | `POST /api/commerce/chatbot` | R1 |
| [review-analysis](./review-analysis/) | 상품 리뷰 자동 분류/분석 | stable | `POST /api/commerce/review-analysis` | R1 |

### Platform Features — 핵심 플랫폼 기능

| 기능 | 설명 | 상태 | 엔드포인트 | 마지막 업데이트 |
|------|------|------|-----------|-----------------|
| [auth](./auth/) | JWT + RefreshToken + RateLimit + DemoSeed | stable | `POST /api/auth/login, /register, /me` | R1 |
| [marketing-hub](./marketing-hub/) | 캠페인/콘텐츠/성과 통합 대시보드 | stable | `GET /api/marketing/hub` | R6-R8 |
| [notifications](./notifications/) | DB 저장 + WebSocket STOMP 푸시 | stable | `GET /api/notifications/me` | R5, R13-R15 |
| [push-notifications](./push-notifications/) | VAPID Web Push + 분석 | stable | `POST /api/notifications/subscribe` | R14c, R15a |
| [admin-dashboard](./admin-dashboard/) | ROLE_ADMIN 가입자/사용량/알림 | stable | `GET /api/admin/stats` | R16b |
| [i18n](./i18n/) | ko/en/ja 다국어 시스템 | stable | N/A (frontend) | R16a |
| [pwa](./pwa/) | manifest + SW + install + skeleton | stable | `manifest.webmanifest, sw.js` | R13, R14b, R15c |

---

## 기능 상세 정보

각 기능 폴더는 다음 4개 파일을 포함합니다:

### 1. `README.md`

- 기능 설명 및 목적
- 사용자 시나리오
- 기술 스택 (백엔드/프론트엔드/테스트)
- API 계약 요약
- 의존성 및 설정

### 2. `manifest.json`

- 파일 경로 매핑 (backend/frontend/tests/docs)
- REST 엔드포인트 목록
- R 라운드 히스토리
- 환경 변수

### 3. `api.md`

- 상세 REST 명세 (요청/응답)
- 오류 코드 및 처리
- 데이터 타입 정의
- 페이지네이션/인증/속도 제한
- WebSocket 메시지 형식
- 파일 업로드 가이드

### 4. `changelog.md`

- R 라운드별 변경 이력
- 성능 개선 메트릭
- 알려진 문제
- 마이그레이션 가이드

---

## 신규 기능 추가

### 자동 생성 (권장)

```bash
# Bash/Linux/macOS
./deploy/scripts/new-feature.sh my-feature

# PowerShell
.\deploy\scripts\new-feature.ps1 -Name my-feature
```

스크립트가 `features/my-feature/` 폴더를 생성하고 _TEMPLATE의 파일을 복사합니다.

### 수동 생성

1. `features/my-feature/` 폴더 생성
2. `_TEMPLATE/` 의 4개 파일을 복사
3. README.md, manifest.json, api.md, changelog.md 편집

---

## 기능 생명주기

| 단계 | 설명 | 예시 |
|------|------|------|
| **experimental** | 초기 개발 단계, API 불안정 | 새로운 파일럿 기능 |
| **beta** | 구현 완료, 제한적 테스트 | 5명 이상 사용자 검증 |
| **stable** | 프로덕션 배포, 문서 완성 | 모든 MaKIT 기능 |

---

## 자주 찾는 것

### 특정 엔드포인트 찾기

```bash
grep -r "POST /api" features/*/manifest.json
```

### 특정 라운드에서 변경된 기능

```bash
grep -r "R16" features/*/changelog.md
```

### 기능의 파일 위치

1. 기능 폴더의 `manifest.json` 열기
2. `files` 섹션에서 백엔드/프론트엔드 경로 확인

---

## 관련 문서

- **시스템 설계**: `docs/architecture/01_architect_system_design.md`
- **API 설계**: `docs/architecture/01_architect_api_contracts.md`
- **데이터 모델**: `docs/architecture/01_architect_data_models.md`
- **프로젝트 구조**: `docs/PROJECT_STRUCTURE.md`
- **CLAUDE.md**: `CLAUDE.md` (하네스 가이드 및 R 라운드 이력)

---

## README 자동 동기화

각 기능 `README.md`의 상단(`<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->` 이전)은 `manifest.json`에서 자동 생성됩니다.

### 헤더 자동 생성 섹션

다음 정보가 자동 생성되어 README 상단에 유지됩니다:
- 기능 표시명, 상태, 카테고리, 소유자
- 엔드포인트 개수
- 파일 개수 (백엔드/프론트/테스트/문서)
- 마지막 변경 라운드

### 수동 편집 영역

마커(`<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->`) 아래의 콘텐츠는 자동 동기화 시에도 **보존**됩니다.

### 동기화 실행

```bash
# 모든 feature README 동기화
./deploy/scripts/sync-feature-readmes.sh

# 변경 사항 미리보기 (실제 파일 수정 없음)
DRY_RUN=1 ./deploy/scripts/sync-feature-readmes.sh
```

---

## 기여 가이드

새 기능을 추가하거나 기존 기능을 개선할 때:

1. 해당 기능 폴더 내 `README.md` 및 `changelog.md` 업데이트 (마커 이후 편집)
2. `manifest.json` 파일 경로, 엔드포인트, roundHistory 확인 및 업데이트
3. `api.md`에 새 엔드포인트 추가
4. `docs/rounds/RN_{agent}_description.md` 라운드 산출물 작성
5. `CLAUDE.md` 변경 이력 테이블에 입력
6. `sync-feature-readmes.sh` 실행하여 README 헤더 동기화

---

마지막 갱신: 2026-04-26 (R18c, R18d)
