# PWA (Progressive Web App)

> **상태**: stable | **카테고리**: platform | **소유자**: @hobbong21

- **엔드포인트**: 0개
- **파일**: backend 0 / frontend 4 / tests 0 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# PWA (Progressive Web App)

> 모바일 설치, 오프라인 지원, 빠른 로딩 (Service Worker)

## 목적

모바일 사용자 경험 향상 및 오프라인 지원

## 사용자 시나리오

1. 사용자가 모바일 Chrome에서 '추가' 버튼으로 설치
2. MaKIT 아이콘이 홈스크린에 추가되어 스탠드얼론 앱처럼 실행
3. Service Worker가 25+ 정적 자산 사전 캐싱
4. 오프라인 상태에서도 이전 페이지 일부 접근 가능

## 기술 스택

### 백엔드
- **서비스**: sw.js, manifest.webmanifest, sw-register.js
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| N/A | 웹 표준 | Required (JWT) |

상세한 내용은 [api.md](./api.md) 참고.

## 의존성

### 내부
- `auth` — JWT 인증
- `audit` — @Auditable 감시

### 외부
- AWS Bedrock (일부 기능)
- PostgreSQL

## 변경 이력

최신 라운드별 이력은 [changelog.md](./changelog.md) 참고.

| 라운드 | 날짜 | 변경 |
|--------|------|------|
| R13b | 2026-04-(PWA | D5 도입) |
| R15c | 2026-04-(skeleton | 추가) |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
