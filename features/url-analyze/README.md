# URL 콘텐츠 분석

> **상태**: stable | **카테고리**: ax-data | **소유자**: @hobbong21

- **엔드포인트**: 1개
- **파일**: backend 4 / frontend 3 / tests 1 / docs 1
- **마지막 변경**: R7
<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->
# URL 콘텐츠 분석

> 웹페이지 URL의 콘텐츠를 분석하여 SEO, 키워드, 구조 평가

## 목적

경쟁사 분석 및 자사 SEO 개선 전략 수립

## 사용자 시나리오

1. SEO 전문가가 경쟁사 웹사이트 URL을 입력
2. 시스템이 페이지 제목, 메타 설명, 주요 키워드, H1~H3 구조 추출
3. Bedrock Claude가 SEO 점수(0~100), 개선 사항 제시
4. 전문가가 자사 콘텐츠 전략에 반영

## 기술 스택

### 백엔드
- **서비스**: UrlAnalysisService
- **AI**: AWS Bedrock Claude Haiku v1.0 (해당 기능)
- **데이터베이스**: PostgreSQL

### 프론트엔드
- **페이지**: `frontend/service-detail.html` (AX Data/Marketing/Commerce) 또는 전용 페이지
- **API 클라이언트**: `js/api.js` 래퍼
- **스타일**: D1 토큰 (Royal Blue 브랜드 색상)

## API 계약

| 메서드 | 경로 | 인증 |
|--------|------|------|
| POST | /api/data/url/analyze | Required (JWT) |

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
| R1 | 2026-04-(초기) |  |
| R7 | 2026-04-(service-detail | 통합) |

## 참고 자료

- 아키텍처: `docs/architecture/01_architect_system_design.md`
- 라운드 산출물: `docs/rounds/`
