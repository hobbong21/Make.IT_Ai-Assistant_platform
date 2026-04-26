# 다국어 지원

> **상태**: stable | **카테고리**: platform | **소유자**: @hobbong21

- **엔드포인트**: 0개
- **파일**: backend 0 / frontend 3 / tests 0 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# 다국어 지원

> 한국어/영어/일본어 동적 번역 (localStorage 기반)

## 목적

글로벌 시장 진출을 위한 다국어 지원

## 사용자 시나리오

1. 사용자가 우상단 글로브 아이콘을 클릭하여 언어 선택
2. localStorage makit_locale에 저장, <html lang> 업데이트
3. data-i18n, data-i18n-attr 패턴으로 DOM 동적 변환
4. 새로운 탭/새로고침 후에도 선택한 언어 유지

## 기술 스택

### 백엔드
- **서비스**: i18n.js, i18n-dict.js (80 키)
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| N/A | 클라이언트측 | Required (JWT) |

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
| R16a | 2026-04-(frontend | i18n 구현) |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
